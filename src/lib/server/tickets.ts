import { and, eq } from 'drizzle-orm';
import type { Db } from './db';
import * as schema from './db/schema';
import { calculateBillableMinutes } from '$lib/timeEntryBilling';
import { claimTicketNumber } from './ticketNumber';
import { resolveQueueForIssueType } from './routing';
import { resolveDefaultContract, validateEligibleContract } from './contracts';
import { getOrganizationTimezone } from './settings';
import {
	computeTriageDueAt,
	computeResponseResolutionDueAt,
	TRANSITIONS,
	PRIORITIES,
	type TicketStatus,
	type Priority
} from '$lib/sla';

// The shared core used by BOTH the manual ticket-creation form action
// (tickets/new/+page.server.ts, source='manual') AND the external ingestion
// endpoint (api/tickets/ingest/+server.ts, source='integration') — same
// validation, same routing-rule application, same SLA-clock-start logic,
// branching only on `source`.
export interface CreateTicketInput {
	title: string;
	description?: string | null;
	companyId: string;
	contractId?: string | null; // omitted = resolve the company's eligible default
	contactId?: string | null;
	issueTypeId?: string | null;
	subIssueTypeId?: string | null;
	queueId?: string | null; // explicit override; otherwise resolved via routing rules
	source: 'manual' | 'email' | 'portal' | 'integration';
	priority?: Priority | null; // required (and trusted) when source === 'integration'
	createdBy?: string | null;
	ingestApiKeyId?: string | null;
	externalRef?: string | null;
}

export async function createTicket(db: Db, input: CreateTicketInput) {
	const now = Math.floor(Date.now() / 1000);

	const company = await db.select().from(schema.companies).where(eq(schema.companies.id, input.companyId)).get();
	if (!company) throw new Error('company not found');
	let contractId: string | null;
	if (input.contractId === undefined) {
		contractId = await resolveDefaultContract(db, input.companyId, now);
	} else if (input.contractId === null) {
		contractId = null;
	} else {
		const contract = await validateEligibleContract(db, input.contractId, input.companyId, now);
		if (!contract) throw new Error('contract is not eligible for the selected company');
		contractId = contract.id;
	}

	const ticketNumber = await claimTicketNumber(db, now, await getOrganizationTimezone(db));
	const queueId = input.queueId ?? (await resolveQueueForIssueType(db, input.issueTypeId, input.subIssueTypeId));
	const id = crypto.randomUUID();

	if (input.source === 'integration') {
		if (!input.priority) throw new Error('priority is required for integration-sourced tickets');

		const priorityRow = await db
			.select()
			.from(schema.slaPolicyPriorities)
			.where(
				and(
					eq(schema.slaPolicyPriorities.policyId, company.slaPolicyId),
					eq(schema.slaPolicyPriorities.priority, input.priority)
				)
			)
			.get();
		const sla = priorityRow ? computeResponseResolutionDueAt(now, priorityRow) : null;

		await db.insert(schema.tickets).values({
			id,
			ticketNumber,
			title: input.title,
			description: input.description ?? null,
			status: 'new',
			priority: input.priority,
			prioritySource: 'integration',
			issueTypeId: input.issueTypeId ?? null,
			subIssueTypeId: input.subIssueTypeId ?? null,
			queueId,
			companyId: input.companyId,
			contractId,
			contactId: input.contactId ?? null,
			source: 'integration',
			createdBy: input.createdBy ?? null,
			ingestApiKeyId: input.ingestApiKeyId ?? null,
			externalRef: input.externalRef ?? null,
			slaClockStartedAt: sla?.slaClockStartedAt ?? null,
			responseDueAt: sla?.responseDueAt ?? null,
			resolutionDueAt: sla?.resolutionDueAt ?? null,
			createdAt: now,
			updatedAt: now
		});
	} else {
		const policy = await db.select().from(schema.slaPolicies).where(eq(schema.slaPolicies.id, company.slaPolicyId)).get();
		const triageMinutes = policy?.triageMinutes ?? 30;

		await db.insert(schema.tickets).values({
			id,
			ticketNumber,
			title: input.title,
			description: input.description ?? null,
			status: 'triage',
			priority: null,
			prioritySource: null,
			issueTypeId: input.issueTypeId ?? null,
			subIssueTypeId: input.subIssueTypeId ?? null,
			queueId,
			companyId: input.companyId,
			contractId,
			contactId: input.contactId ?? null,
			source: input.source,
			createdBy: input.createdBy ?? null,
			triageDueAt: computeTriageDueAt(now, triageMinutes),
			createdAt: now,
			updatedAt: now
		});
	}

	return (await db.select().from(schema.tickets).where(eq(schema.tickets.id, id)).get())!;
}

export interface FoldIngestRecurrenceInput {
	priority: Priority;
	// Note author for the recurrence note — typically the ingest API key's
	// createdBy admin (see verifyApiKey in lib/server/auth/apiKeys.ts). Note
	// is skipped entirely when null (key has no recorded creator).
	noteResourceId?: string | null;
}

// Called by the ingest endpoint (api/tickets/ingest/+server.ts) when a
// re-ingested (ingestApiKeyId, externalRef) pair matches an existing ticket
// that isn't closed yet (see the partial tickets_ingest_dedup index in
// db/schema.ts), instead of inserting a duplicate. Escalates priority only —
// never downgrades — and deliberately leaves SLA clocks untouched (they're
// snapshotted once, same invariant as triageTicket/createTicket above).
export async function foldIngestRecurrence(db: Db, ticketId: string, input: FoldIngestRecurrenceInput): Promise<void> {
	const ticket = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticketId)).get();
	if (!ticket) throw new Error('ticket not found');

	const now = Math.floor(Date.now() / 1000);
	const currentPriority = ticket.priority as Priority; // always set — integration tickets require a priority at creation
	const escalated = PRIORITIES.indexOf(input.priority) < PRIORITIES.indexOf(currentPriority);

	const updates: Partial<typeof schema.tickets.$inferInsert> = { updatedAt: now };
	if (escalated) updates.priority = input.priority;

	await db.update(schema.tickets).set(updates).where(eq(schema.tickets.id, ticketId));

	if (input.noteResourceId) {
		const body = escalated
			? `Ingest re-fired for this ticket — priority escalated from ${currentPriority} to ${input.priority}.`
			: `Ingest re-fired for this ticket — priority unchanged (${currentPriority}).`;
		await addNote(db, { ticketId, resourceId: input.noteResourceId, body, visibility: 'internal' });
	}
}

// The concrete enforcement of "a ticket cannot leave Triage without a
// priority set" — this is the only path that moves a ticket out of `triage`.
export async function triageTicket(db: Db, ticketId: string, priority: Priority): Promise<void> {
	const ticket = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticketId)).get();
	if (!ticket) throw new Error('ticket not found');
	if (ticket.status !== 'triage') throw new Error('ticket is not in triage');

	const company = await db.select().from(schema.companies).where(eq(schema.companies.id, ticket.companyId)).get();
	if (!company) throw new Error('company not found');

	const now = Math.floor(Date.now() / 1000);
	const priorityRow = await db
		.select()
		.from(schema.slaPolicyPriorities)
		.where(
			and(
				eq(schema.slaPolicyPriorities.policyId, company.slaPolicyId),
				eq(schema.slaPolicyPriorities.priority, priority)
			)
		)
		.get();
	const sla = priorityRow
		? computeResponseResolutionDueAt(now, priorityRow)
		: { slaClockStartedAt: now, responseDueAt: null, resolutionDueAt: null };

	await db
		.update(schema.tickets)
		.set({
			status: 'new',
			priority,
			prioritySource: 'manual',
			slaClockStartedAt: sla.slaClockStartedAt,
			responseDueAt: sla.responseDueAt,
			resolutionDueAt: sla.resolutionDueAt,
			updatedAt: now
		})
		.where(eq(schema.tickets.id, ticketId));
}

export async function setStatus(db: Db, ticketId: string, nextStatus: TicketStatus): Promise<void> {
	const ticket = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticketId)).get();
	if (!ticket) throw new Error('ticket not found');

	const allowed = TRANSITIONS[ticket.status as TicketStatus];
	if (!allowed.includes(nextStatus)) {
		throw new Error(`cannot transition from ${ticket.status} to ${nextStatus}`);
	}

	const now = Math.floor(Date.now() / 1000);
	const updates: Partial<typeof schema.tickets.$inferInsert> = { status: nextStatus, updatedAt: now };

	if (nextStatus === 'resolved') {
		updates.resolvedAt = now;
	} else if (nextStatus === 'closed') {
		updates.closedAt = now;
		if (!ticket.resolvedAt) updates.resolvedAt = now;
	} else if (ticket.status === 'resolved' || ticket.status === 'closed') {
		// Reopening — clear both so a subsequent resolve/close sets them fresh.
		updates.resolvedAt = null;
		updates.closedAt = null;
	}

	// Leaving Waiting on Client is treated as the tech having addressed
	// whatever prompted the flag — independent of SLA breach state.
	if (ticket.status === 'waiting_on_client' && nextStatus !== 'waiting_on_client') {
		updates.needsTechAttention = false;
	}

	await db.update(schema.tickets).set(updates).where(eq(schema.tickets.id, ticketId));
}

export async function assignTicket(db: Db, ticketId: string, resourceId: string | null): Promise<void> {
	await db
		.update(schema.tickets)
		.set({ assignedResourceId: resourceId, updatedAt: Math.floor(Date.now() / 1000) })
		.where(eq(schema.tickets.id, ticketId));
}

// The v1 manual stand-in for future email/portal client-reply detection.
// Sets needsTechAttention unconditionally (independent of status/SLA state)
// and leaves an audit-trail note distinguishing "tech says client replied"
// from a future real detector.
export async function markClientReplied(db: Db, ticketId: string, actingUserId: string): Promise<void> {
	const now = Math.floor(Date.now() / 1000);
	await db.update(schema.tickets).set({ needsTechAttention: true, updatedAt: now }).where(eq(schema.tickets.id, ticketId));
	await db.insert(schema.notes).values({
		id: crypto.randomUUID(),
		ticketId,
		resourceId: actingUserId,
		body: 'Marked "Needs Tech Attention" — client reply recorded manually.',
		visibility: 'internal',
		createdAt: now
	});
}

export async function addNote(
	db: Db,
	input: { ticketId: string; resourceId: string; body: string; visibility: 'internal' | 'client_visible' }
): Promise<void> {
	await db.insert(schema.notes).values({
		id: crypto.randomUUID(),
		ticketId: input.ticketId,
		resourceId: input.resourceId,
		body: input.body,
		visibility: input.visibility,
		createdAt: Math.floor(Date.now() / 1000)
	});
}

export async function addTimeEntry(
	db: Db,
	input: {
		ticketId: string;
		resourceId: string;
		durationMinutes: number;
		notes?: string | null;
		internalNotes?: string | null;
		workDate: number;
		startAt?: number | null;
		endAt?: number | null;
		billingOffsetMinutes?: number;
		billable?: boolean | null;
		workTypeId?: string | null;
		resourceRoleId?: string | null;
	}
): Promise<void> {
	let billable = input.billable;
	const ticket = await db
		.select({ companyId: schema.tickets.companyId, contractId: schema.tickets.contractId })
		.from(schema.tickets)
		.where(eq(schema.tickets.id, input.ticketId))
		.get();
	if (!ticket) throw new Error('ticket not found');

	if (billable == null) {
		const company = ticket
			? await db
					.select({ defaultBillable: schema.companies.defaultBillable })
					.from(schema.companies)
					.where(eq(schema.companies.id, ticket.companyId))
					.get()
			: null;
		billable = company?.defaultBillable ?? true;
	}

	const contract = ticket.contractId
		? await db
				.select({
					id: schema.contracts.id,
					billingModel: schema.contracts.billingModel,
					hourlyRateCents: schema.contracts.hourlyRateCents
				})
				.from(schema.contracts)
				.where(eq(schema.contracts.id, ticket.contractId))
				.get()
		: null;
	const workType = input.workTypeId
		? await db.select().from(schema.workTypes).where(eq(schema.workTypes.id, input.workTypeId)).get()
		: await db.select().from(schema.workTypes).where(eq(schema.workTypes.isDefault, true)).get();
	if (!workType || !workType.isActive) throw new Error('Choose an active Work Type.');
	const assignedRoles = await db
		.select({ role: schema.resourceRoles })
		.from(schema.userResourceRoles)
		.innerJoin(schema.resourceRoles, eq(schema.userResourceRoles.resourceRoleId, schema.resourceRoles.id))
		.where(eq(schema.userResourceRoles.userId, input.resourceId))
		.all();
	const resourceRole =
		assignedRoles.find(({ role }) => role.id === input.resourceRoleId)?.role ??
		assignedRoles.find(({ role }) => role.isDefault)?.role ??
		assignedRoles.find(({ role }) => role.isActive)?.role ??
		(await db.select().from(schema.resourceRoles).where(eq(schema.resourceRoles.isDefault, true)).get());
	if (!resourceRole || !resourceRole.isActive) throw new Error('Choose an active Resource Role assigned to this technician.');
	if (input.resourceRoleId && !assignedRoles.some(({ role }) => role.id === input.resourceRoleId))
		throw new Error('That Resource Role is not assigned to this technician.');
	const settings = await db.select().from(schema.organizationSettings).where(eq(schema.organizationSettings.id, 'organization-default')).get();
	const billingOffsetMinutes = settings?.allowBillingOffset ? (input.billingOffsetMinutes ?? 0) : 0;
	if (input.billable == null) billable = workType.billableByDefault;
	const billingRoundingMinutes = workType.roundingMinutes ?? settings?.billingRoundingMinutes ?? 0;
	const billableMinutes = billable
		? calculateBillableMinutes(input.durationMinutes, billingOffsetMinutes, {
				minimumBillableMinutes: workType.minimumBillableMinutes,
				roundingMinutes: billingRoundingMinutes
			})
		: 0;

	await db.insert(schema.timeEntries).values({
		id: crypto.randomUUID(),
		ticketId: input.ticketId,
		resourceId: input.resourceId,
		contractId: contract?.id ?? null,
		contractBillingModel: contract?.billingModel ?? null,
		contractRateCents: contract?.hourlyRateCents ?? null,
		durationMinutes: input.durationMinutes,
		notes: input.notes ?? null,
		internalNotes: input.internalNotes ?? null,
		workDate: input.workDate,
		startAt: input.startAt ?? null,
		endAt: input.endAt ?? null,
		billingOffsetMinutes,
		workTypeId: workType.id,
		resourceRoleId: resourceRole.id,
		workTypeName: workType.name,
		resourceRoleName: resourceRole.name,
		resourceRoleRateCents: resourceRole.hourlyRateCents,
		minimumBillableMinutes: workType.minimumBillableMinutes,
		billingRoundingMinutes,
		billableMinutes,
		billable,
		createdAt: Math.floor(Date.now() / 1000)
	});
}

export async function deleteTimeEntry(db: Db, timeEntryId: string): Promise<void> {
	await db.delete(schema.timeEntries).where(eq(schema.timeEntries.id, timeEntryId));
}

export interface UpdateTicketHeaderInput {
	title?: string;
	description?: string | null;
	companyId?: string;
	contractId?: string | null;
	contactId?: string | null;
	issueTypeId?: string | null;
	subIssueTypeId?: string | null;
	estimatedMinutes?: number | null;
	queueId?: string; // explicit override — wins over re-running routing
}

export async function updateTicketHeader(db: Db, ticketId: string, input: UpdateTicketHeaderInput): Promise<void> {
	const ticket = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticketId)).get();
	if (!ticket) throw new Error('ticket not found');

	const updates: Partial<typeof schema.tickets.$inferInsert> = { updatedAt: Math.floor(Date.now() / 1000) };
	if (input.title !== undefined) updates.title = input.title;
	if (input.description !== undefined) updates.description = input.description;
	const nextCompanyId = input.companyId ?? ticket.companyId;
	if (input.companyId !== undefined) updates.companyId = nextCompanyId;
	if (input.contractId !== undefined) {
		if (input.contractId === null) {
			updates.contractId = null;
		} else if (input.contractId === ticket.contractId && nextCompanyId === ticket.companyId) {
			updates.contractId = input.contractId;
		} else {
			const contract = await validateEligibleContract(db, input.contractId, nextCompanyId);
			if (!contract) throw new Error('contract is not eligible for the selected company');
			updates.contractId = contract.id;
		}
	} else if (input.companyId !== undefined && input.companyId !== ticket.companyId) {
		updates.contractId = await resolveDefaultContract(db, nextCompanyId);
	}
	if (input.contactId !== undefined) updates.contactId = input.contactId;
	if (input.issueTypeId !== undefined) updates.issueTypeId = input.issueTypeId;
	if (input.subIssueTypeId !== undefined) updates.subIssueTypeId = input.subIssueTypeId;
	if (input.estimatedMinutes !== undefined) updates.estimatedMinutes = input.estimatedMinutes;

	if (input.queueId !== undefined) {
		updates.queueId = input.queueId;
	} else if (input.issueTypeId !== undefined || input.subIssueTypeId !== undefined) {
		updates.queueId = await resolveQueueForIssueType(
			db,
			input.issueTypeId !== undefined ? input.issueTypeId : ticket.issueTypeId,
			input.subIssueTypeId !== undefined ? input.subIssueTypeId : ticket.subIssueTypeId
		);
	}

	await db.update(schema.tickets).set(updates).where(eq(schema.tickets.id, ticketId));
}
