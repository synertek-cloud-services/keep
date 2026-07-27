import { error, fail } from '@sveltejs/kit';
// Ticket details render in the standalone authenticated workspace route group.
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import {
	triageTicket,
	setStatus as setTicketStatus,
	assignTicket,
	markClientReplied,
	addNote,
	addTimeEntry,
	deleteTimeEntry,
	updateTicketHeader
} from '$lib/server/tickets';
import { nextValidStatuses, canLeaveTriage, type Priority, type TicketStatus } from '$lib/sla';
import { utcDayStart } from '$lib/server/contracts';
import { getOrganizationTimezone, ORGANIZATION_SETTINGS_ID } from '$lib/server/settings';
import { parseTicketWorkspaceLayout, resolveTicketWorkspaceLayout } from '$lib/ticketWorkspace';
import { addUtcDays, zonedDateTimeToEpoch } from '$lib/server/timeEntryTime';
import {
	DEFAULT_ALLOWED_ATTACHMENT_TYPES,
	DEFAULT_MAX_ATTACHMENT_BYTES,
	parseAllowedAttachmentTypes,
	safeAttachmentFileName,
	validateAttachment
} from '$lib/attachmentPolicy';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	const db = getDb(platform!);

	const ticket = await db.select().from(schema.tickets).where(eq(schema.tickets.id, params.id)).get();
	if (!ticket) error(404, { message: 'Ticket not found' });

	const [company, contact, queue, issueType, subIssueType, assignedResource, organizationSettings, currentUser] = await Promise.all([
		db.select().from(schema.companies).where(eq(schema.companies.id, ticket.companyId)).get(),
		ticket.contactId ? db.select().from(schema.contacts).where(eq(schema.contacts.id, ticket.contactId)).get() : null,
		db.select().from(schema.queues).where(eq(schema.queues.id, ticket.queueId)).get(),
		ticket.issueTypeId ? db.select().from(schema.issueTypes).where(eq(schema.issueTypes.id, ticket.issueTypeId)).get() : null,
		ticket.subIssueTypeId ? db.select().from(schema.subIssueTypes).where(eq(schema.subIssueTypes.id, ticket.subIssueTypeId)).get() : null,
		ticket.assignedResourceId ? db.select().from(schema.users).where(eq(schema.users.id, ticket.assignedResourceId)).get() : null,
		db.select().from(schema.organizationSettings).where(eq(schema.organizationSettings.id, ORGANIZATION_SETTINGS_ID)).get(),
		db.select({ ticketWorkspaceLayout: schema.users.ticketWorkspaceLayout }).from(schema.users).where(eq(schema.users.id, locals.user!.id)).get()
	]);

	const notes = await db
		.select({
			id: schema.notes.id,
			body: schema.notes.body,
			visibility: schema.notes.visibility,
			createdAt: schema.notes.createdAt,
			resourceName: schema.users.displayName,
			resourceEmail: schema.users.email
		})
		.from(schema.notes)
		.innerJoin(schema.users, eq(schema.users.id, schema.notes.resourceId))
		.where(eq(schema.notes.ticketId, params.id))
		.orderBy(desc(schema.notes.createdAt))
		.all();
	const attachments = await db
		.select({
			id: schema.attachments.id,
			fileName: schema.attachments.fileName,
			contentType: schema.attachments.contentType,
			sizeBytes: schema.attachments.sizeBytes,
			visibility: schema.attachments.visibility,
			createdAt: schema.attachments.createdAt,
			uploaderId: schema.attachments.uploaderId,
			uploaderName: schema.users.displayName,
			uploaderEmail: schema.users.email
		})
		.from(schema.attachments)
		.innerJoin(schema.users, eq(schema.users.id, schema.attachments.uploaderId))
		.where(eq(schema.attachments.ticketId, params.id))
		.orderBy(desc(schema.attachments.createdAt))
		.all();

	const timeEntries = await db
		.select({
			id: schema.timeEntries.id,
			durationMinutes: schema.timeEntries.durationMinutes,
			notes: schema.timeEntries.notes,
			internalNotes: schema.timeEntries.internalNotes,
			workDate: schema.timeEntries.workDate,
			startAt: schema.timeEntries.startAt,
			endAt: schema.timeEntries.endAt,
			billingOffsetMinutes: schema.timeEntries.billingOffsetMinutes,
			billableMinutes: schema.timeEntries.billableMinutes,
			workTypeName: schema.timeEntries.workTypeName,
			resourceRoleName: schema.timeEntries.resourceRoleName,
			billable: schema.timeEntries.billable,
			contractName: schema.contracts.name,
			contractBillingModel: schema.timeEntries.contractBillingModel,
			contractRateCents: schema.timeEntries.contractRateCents,
			resourceName: schema.users.displayName,
			resourceEmail: schema.users.email
		})
		.from(schema.timeEntries)
		.innerJoin(schema.users, eq(schema.users.id, schema.timeEntries.resourceId))
		.leftJoin(schema.contracts, eq(schema.contracts.id, schema.timeEntries.contractId))
		.where(eq(schema.timeEntries.ticketId, params.id))
		.orderBy(desc(schema.timeEntries.workDate))
		.all();

	const companies = await db.select().from(schema.companies).orderBy(schema.companies.name).all();
	const contacts = await db.select().from(schema.contacts).all();
	const issueTypes = await db.select().from(schema.issueTypes).orderBy(schema.issueTypes.sortOrder).all();
	const subIssueTypes = await db.select().from(schema.subIssueTypes).orderBy(schema.subIssueTypes.sortOrder).all();
	const queues = await db.select().from(schema.queues).orderBy(schema.queues.name).all();
	const users = await db.select().from(schema.users).where(eq(schema.users.isActive, true)).all();
	const workTypes = await db.select().from(schema.workTypes).where(eq(schema.workTypes.isActive, true)).orderBy(schema.workTypes.name).all();
	const resourceRoles = await db
		.select({
			id: schema.resourceRoles.id,
			name: schema.resourceRoles.name,
			hourlyRateCents: schema.resourceRoles.hourlyRateCents,
			isDefault: schema.userResourceRoles.isDefault
		})
		.from(schema.userResourceRoles)
		.innerJoin(schema.resourceRoles, eq(schema.userResourceRoles.resourceRoleId, schema.resourceRoles.id))
		.where(and(eq(schema.userResourceRoles.userId, locals.user!.id), eq(schema.resourceRoles.isActive, true)))
		.orderBy(desc(schema.userResourceRoles.isDefault), schema.resourceRoles.name)
		.all();
	const today = utcDayStart(Math.floor(Date.now() / 1000));
	const eligibleContractCondition = and(
		eq(schema.contracts.status, 'active'),
		lte(schema.contracts.startDate, today),
		or(isNull(schema.contracts.endDate), gte(schema.contracts.endDate, today))
	);
	const contracts = await db
		.select({
			id: schema.contracts.id,
			companyId: schema.contracts.companyId,
			name: schema.contracts.name,
			status: schema.contracts.status,
			billingModel: schema.contracts.billingModel,
			isDefault: schema.contracts.isDefault
		})
		.from(schema.contracts)
		.where(
			ticket.contractId
				? or(eligibleContractCondition, eq(schema.contracts.id, ticket.contractId))
				: eligibleContractCondition
		)
		.orderBy(schema.contracts.name)
		.all();
	const organizationTimezone = await getOrganizationTimezone(db);
	const timeFormatter = new Intl.DateTimeFormat('en-CA', {
		timeZone: organizationTimezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	});
	const partsFor = (date: Date) => {
		const parts = timeFormatter.formatToParts(date);
		const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
		return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
	};
	const defaultEnd = partsFor(new Date());
	const defaultStart = partsFor(new Date(Date.now() - 30 * 60 * 1000));

	return {
		ticket,
		company,
		contact,
		queue,
		issueType,
		subIssueType,
		assignedResource,
		notes,
		attachments,
		timeEntries,
		companies,
		contacts,
		issueTypes,
		subIssueTypes,
		queues,
		users,
		contracts,
		workTypes,
		resourceRoles,
		workspaceLayout: resolveTicketWorkspaceLayout(
			currentUser?.ticketWorkspaceLayout,
			organizationSettings?.ticketWorkspaceLayout
		),
		hasPersonalWorkspace: Boolean(parseTicketWorkspaceLayout(currentUser?.ticketWorkspaceLayout)),
		organizationTimezone,
		timeSettings: {
			businessStartMinute: organizationSettings?.businessStartMinute ?? 480,
			businessEndMinute: organizationSettings?.businessEndMinute ?? 1080,
			timeEntryIncrementMinutes: organizationSettings?.timeEntryIncrementMinutes ?? 5,
			billingRoundingMinutes: organizationSettings?.billingRoundingMinutes ?? 15,
			allowBillingOffset: organizationSettings?.allowBillingOffset ?? true
		},
		defaultTimeEntry: {
			workDate: defaultEnd.date,
			startTime: defaultStart.time,
			endTime: defaultEnd.time
		},
		nextStatuses: nextValidStatuses(ticket.status as TicketStatus)
	};
};

export const actions: Actions = {
	saveWorkspace: async ({ request, locals, platform }) => {
		const form = await request.formData();
		const layout = parseTicketWorkspaceLayout(String(form.get('layout') ?? ''));
		if (!layout) return fail(400, { error: 'The workspace layout is invalid or incomplete.' });
		const db = getDb(platform!);
		await db
			.update(schema.users)
			.set({ ticketWorkspaceLayout: JSON.stringify(layout), updatedAt: Math.floor(Date.now() / 1000) })
			.where(eq(schema.users.id, locals.user!.id));
		return { success: true, workspaceSaved: true };
	},

	resetWorkspace: async ({ locals, platform }) => {
		const db = getDb(platform!);
		await db
			.update(schema.users)
			.set({ ticketWorkspaceLayout: null, updatedAt: Math.floor(Date.now() / 1000) })
			.where(eq(schema.users.id, locals.user!.id));
		return { success: true, workspaceReset: true };
	},

	updateHeader: async ({ request, params, platform }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const estimatedRaw = String(form.get('estimatedMinutes') ?? '').trim();
		const estimatedMinutes = estimatedRaw ? Number(estimatedRaw) : null;
		if (!title) return fail(400, { error: 'Title is required.' });
		if (estimatedMinutes != null && (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 0))
			return fail(400, { error: 'Estimated time must be a non-negative whole number of minutes.' });

		const db = getDb(platform!);
		try {
			await updateTicketHeader(db, params.id, {
				title,
				description: String(form.get('description') ?? '').trim() || null,
				companyId: String(form.get('companyId') ?? ''),
				contractId: String(form.get('contractId') ?? '') || null,
				contactId: String(form.get('contactId') ?? '') || null,
				issueTypeId: String(form.get('issueTypeId') ?? '') || null,
				subIssueTypeId: String(form.get('subIssueTypeId') ?? '') || null,
				estimatedMinutes
			});
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to update ticket.' });
		}
		return { success: true };
	},

	triage: async ({ request, params, platform }) => {
		const form = await request.formData();
		const priority = String(form.get('priority') ?? '') as Priority;
		if (!canLeaveTriage(priority)) return fail(400, { error: 'A valid priority is required to leave Triage.' });

		const db = getDb(platform!);
		try {
			await triageTicket(db, params.id, priority);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to triage ticket.' });
		}
		return { success: true };
	},

	setStatus: async ({ request, params, platform }) => {
		const form = await request.formData();
		const status = String(form.get('status') ?? '') as TicketStatus;

		const db = getDb(platform!);
		try {
			await setTicketStatus(db, params.id, status);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Invalid status transition.' });
		}
		return { success: true };
	},

	assign: async ({ request, params, platform }) => {
		const form = await request.formData();
		const resourceId = String(form.get('resourceId') ?? '') || null;
		const db = getDb(platform!);
		await assignTicket(db, params.id, resourceId);
		return { success: true };
	},

	selfAssign: async ({ params, locals, platform }) => {
		const db = getDb(platform!);
		await assignTicket(db, params.id, locals.user!.id);
		return { success: true };
	},

	clientReply: async ({ params, locals, platform }) => {
		const db = getDb(platform!);
		await markClientReplied(db, params.id, locals.user!.id);
		return { success: true };
	},

	addNote: async ({ request, params, locals, platform }) => {
		const form = await request.formData();
		const body = String(form.get('body') ?? '').trim();
		// Internal is a binary UI choice rather than a two-option picker.
		// Checked remains the safe default; unchecked is client-visible.
		const visibility = form.get('internal') === 'on' ? 'internal' : 'client_visible';
		if (!body) return fail(400, { error: 'Note body is required.' });

		const db = getDb(platform!);
		await addNote(db, { ticketId: params.id, resourceId: locals.user!.id, body, visibility });
		return { success: true };
	},

	addAttachment: async ({ request, params, locals, platform }) => {
		const form = await request.formData();
		const candidate = form.get('file');
		if (!(candidate instanceof File))
			return fail(400, { error: 'Choose a file to attach.', keepAttachmentComposerOpen: true });
		const db = getDb(platform!);
		const settings = await db
			.select({
				maxAttachmentBytes: schema.organizationSettings.maxAttachmentBytes,
				allowedAttachmentTypes: schema.organizationSettings.allowedAttachmentTypes
			})
			.from(schema.organizationSettings)
			.where(eq(schema.organizationSettings.id, ORGANIZATION_SETTINGS_ID))
			.get();
		const validationError = validateAttachment(candidate, {
			maxBytes: settings?.maxAttachmentBytes ?? DEFAULT_MAX_ATTACHMENT_BYTES,
			allowedTypes: parseAllowedAttachmentTypes(
				settings?.allowedAttachmentTypes ?? JSON.stringify(DEFAULT_ALLOWED_ATTACHMENT_TYPES)
			)
		});
		if (validationError)
			return fail(400, { error: validationError, keepAttachmentComposerOpen: true });
		const ticketExists = await db.select({ id: schema.tickets.id }).from(schema.tickets).where(eq(schema.tickets.id, params.id)).get();
		if (!ticketExists) return fail(404, { error: 'Ticket not found.' });

		const id = crypto.randomUUID();
		const storageKey = `tickets/${params.id}/${id}`;
		const contentType = candidate.type.trim().toLowerCase() || 'application/octet-stream';
		await platform!.env.ATTACHMENTS.put(storageKey, candidate.stream(), {
			httpMetadata: { contentType }
		});
		try {
			await db.insert(schema.attachments).values({
				id,
				ticketId: params.id,
				uploaderId: locals.user!.id,
				fileName: safeAttachmentFileName(candidate.name),
				contentType,
				sizeBytes: candidate.size,
				storageKey,
				visibility: form.get('internal') === 'on' ? 'internal' : 'client_visible',
				createdAt: Math.floor(Date.now() / 1000)
			});
		} catch (e) {
			await platform!.env.ATTACHMENTS.delete(storageKey);
			throw e;
		}
		return { success: true, attachmentSaved: true };
	},

	deleteAttachment: async ({ request, params, locals, platform }) => {
		const form = await request.formData();
		const attachmentId = String(form.get('attachmentId') ?? '');
		const db = getDb(platform!);
		const attachment = await db
			.select()
			.from(schema.attachments)
			.where(and(eq(schema.attachments.id, attachmentId), eq(schema.attachments.ticketId, params.id)))
			.get();
		if (!attachment) return fail(404, { error: 'Attachment not found.' });
		if (attachment.uploaderId !== locals.user!.id && locals.user!.role !== 'admin')
			return fail(403, { error: 'Only the uploader or an admin can delete this attachment.' });
		await db.delete(schema.attachments).where(eq(schema.attachments.id, attachmentId));
		await platform!.env.ATTACHMENTS.delete(attachment.storageKey);
		return { success: true, attachmentDeleted: true };
	},

	addTimeEntry: async ({ request, params, locals, platform }) => {
		const form = await request.formData();
		const workDateStr = String(form.get('workDate') ?? '');
		const startTime = String(form.get('startTime') ?? '');
		const endTime = String(form.get('endTime') ?? '');
		const notes = String(form.get('notes') ?? '').trim();
		const internalNotes = String(form.get('internalNotes') ?? '').trim() || null;
		const billableRaw = form.get('billable');
		const billingOffsetMinutes = Number(form.get('billingOffsetMinutes') ?? 0);
		const workTypeId = String(form.get('workTypeId') ?? '');
		const resourceRoleId = String(form.get('resourceRoleId') ?? '');
		const saveMode = String(form.get('saveMode') ?? 'close');

		if (!workDateStr || !startTime || !endTime || !notes || !workTypeId || !resourceRoleId)
			return fail(400, { error: 'Date, times, Work Type, Resource Role, and work performed are required.', keepTimeModalOpen: true });

		const db = getDb(platform!);
		const timezone = await getOrganizationTimezone(db);
		const endDate = form.get('endsNextDay') === 'on' ? addUtcDays(workDateStr, 1) : workDateStr;
		const startAt = zonedDateTimeToEpoch(workDateStr, startTime, timezone);
		const endAt = endDate ? zonedDateTimeToEpoch(endDate, endTime, timezone) : null;
		if (startAt == null || endAt == null || endAt <= startAt)
			return fail(400, { error: 'End time must be after start time. Use “Ends next day” for overnight work.', keepTimeModalOpen: true });
		const durationMinutes = Math.round((endAt - startAt) / 60);
		if (durationMinutes <= 0 || durationMinutes > 24 * 60)
			return fail(400, { error: 'Time worked must be greater than zero and no more than 24 hours.', keepTimeModalOpen: true });
		if (
			!Number.isInteger(billingOffsetMinutes) ||
			durationMinutes + billingOffsetMinutes < 0 ||
			durationMinutes + billingOffsetMinutes > 24 * 60
		)
			return fail(400, { error: 'Billing offset must leave time to bill between zero and 24 hours.', keepTimeModalOpen: true });

		const requestedStatus = String(form.get('ticketStatus') ?? '') as TicketStatus | '';
		if (requestedStatus) {
			const ticket = await db.select({ status: schema.tickets.status }).from(schema.tickets).where(eq(schema.tickets.id, params.id)).get();
			if (!ticket || !nextValidStatuses(ticket.status as TicketStatus).includes(requestedStatus))
				return fail(400, { error: 'The selected ticket status transition is no longer valid.', keepTimeModalOpen: true });
		}

		try {
			await addTimeEntry(db, {
				ticketId: params.id,
				resourceId: locals.user!.id,
				durationMinutes,
				notes,
				internalNotes,
				workDate: Date.parse(`${workDateStr}T00:00:00Z`) / 1000,
				startAt,
				endAt,
				billingOffsetMinutes,
				workTypeId,
				resourceRoleId,
				billable: billableRaw === 'on'
			});
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'Failed to save the time entry.',
				keepTimeModalOpen: true
			});
		}
		if (requestedStatus) await setTicketStatus(db, params.id, requestedStatus);
		return { success: true, timeEntrySaved: true, keepTimeModalOpen: saveMode === 'new' };
	},

	deleteTimeEntry: async ({ request, platform }) => {
		const form = await request.formData();
		const entryId = String(form.get('entryId') ?? '');
		const db = getDb(platform!);
		await deleteTimeEntry(db, entryId);
		return { success: true };
	}
};
