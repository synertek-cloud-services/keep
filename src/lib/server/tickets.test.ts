import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { applyMigrationsForTest } from './db/testMigrate';
import * as schema from './db/schema';
import {
	addTimeEntry,
	createTicket,
	markClientReplied,
	setStatus,
	triageTicket,
	updateTicketHeader
} from './tickets';

const db = drizzle(env.DB, { schema });
let companyId: string;
let resourceId: string;
let defaultContractId: string;

beforeAll(async () => {
	await applyMigrationsForTest(env.DB);

	const now = Math.floor(Date.now() / 1000);
	companyId = crypto.randomUUID();
	resourceId = crypto.randomUUID();
	defaultContractId = crypto.randomUUID();
	await db.insert(schema.companies).values({
		id: companyId,
		name: 'Test Co',
		slaPolicyId: 'sla-standard', // seeded baseline policy
		createdAt: now,
		updatedAt: now
	});
	await db.insert(schema.users).values({
		id: resourceId,
		email: 'tech@test.local',
		role: 'tech',
		authSource: 'local',
		createdAt: now,
		updatedAt: now
	});
	await db.insert(schema.contracts).values({
		id: defaultContractId,
		companyId,
		name: 'Test Default Contract',
		status: 'active',
		type: 'recurring',
		billingModel: 'included_hours',
		startDate: Date.UTC(2020, 0, 1) / 1000,
		includedMinutes: 600,
		hourlyRateCents: 15_000,
		isDefault: true,
		createdAt: now,
		updatedAt: now
	});
});

describe('createTicket', () => {
	it('manual source lands in triage with priority=null and a triageDueAt set', async () => {
		const ticket = await createTicket(db, { title: 'Manual ticket', companyId, source: 'manual' });
		expect(ticket.status).toBe('triage');
		expect(ticket.priority).toBeNull();
		expect(ticket.prioritySource).toBeNull();
		expect(ticket.triageDueAt).not.toBeNull();
		expect(ticket.responseDueAt).toBeNull();
		expect(ticket.contractId).toBe(defaultContractId);
	});

	it('integration source skips Triage and sets SLA clocks immediately', async () => {
		const ticket = await createTicket(db, {
			title: 'Integration ticket',
			companyId,
			source: 'integration',
			priority: 'high'
		});
		expect(ticket.status).toBe('new');
		expect(ticket.priority).toBe('high');
		expect(ticket.prioritySource).toBe('integration');
		expect(ticket.triageDueAt).toBeNull();
		expect(ticket.responseDueAt).not.toBeNull();
		expect(ticket.resolutionDueAt).not.toBeNull();
		expect(ticket.contractId).toBe(defaultContractId);
	});

	it('rejects an explicitly selected contract from another company', async () => {
		const now = Math.floor(Date.now() / 1000);
		const otherCompanyId = crypto.randomUUID();
		const otherContractId = crypto.randomUUID();
		await db.insert(schema.companies).values({
			id: otherCompanyId,
			name: 'Other Company',
			slaPolicyId: 'sla-standard',
			createdAt: now,
			updatedAt: now
		});
		await db.insert(schema.contracts).values({
			id: otherContractId,
			companyId: otherCompanyId,
			name: 'Other Contract',
			status: 'active',
			type: 'recurring',
			billingModel: 'hourly',
			startDate: Date.UTC(2020, 0, 1) / 1000,
			hourlyRateCents: 20_000,
			createdAt: now,
			updatedAt: now
		});

		await expect(
			createTicket(db, { title: 'Wrong contract', companyId, contractId: otherContractId, source: 'manual' })
		).rejects.toThrow('contract is not eligible for the selected company');
	});
});

describe('ticket contract assignment', () => {
	it('does not retroactively change a ticket when the company default changes', async () => {
		const ticket = await createTicket(db, { title: 'Contract snapshot', companyId, source: 'manual' });
		await db.update(schema.contracts).set({ isDefault: false }).where(eq(schema.contracts.id, defaultContractId));
		const refreshed = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id)).get();
		expect(refreshed?.contractId).toBe(defaultContractId);
		await db.update(schema.contracts).set({ isDefault: true }).where(eq(schema.contracts.id, defaultContractId));
	});

	it('rejects assigning a cross-company contract during a header update', async () => {
		const ticket = await createTicket(db, { title: 'Header contract', companyId, source: 'manual' });
		const other = await db
			.select({ id: schema.contracts.id })
			.from(schema.contracts)
			.where(eq(schema.contracts.name, 'Other Contract'))
			.get();
		await expect(updateTicketHeader(db, ticket.id, { contractId: other!.id })).rejects.toThrow(
			'contract is not eligible for the selected company'
		);
	});

	it('snapshots contract billing context on new time entries', async () => {
		const ticket = await createTicket(db, { title: 'Time contract', companyId, source: 'manual' });
		await addTimeEntry(db, {
			ticketId: ticket.id,
			resourceId,
			durationMinutes: 60,
			workDate: Date.UTC(2026, 6, 27) / 1000,
			billable: true
		});
		await db
			.update(schema.contracts)
			.set({ billingModel: 'hourly', hourlyRateCents: 25_000 })
			.where(eq(schema.contracts.id, defaultContractId));

		const entry = await db
			.select()
			.from(schema.timeEntries)
			.where(eq(schema.timeEntries.ticketId, ticket.id))
			.get();
		expect(entry?.contractId).toBe(defaultContractId);
		expect(entry?.contractBillingModel).toBe('included_hours');
		expect(entry?.contractRateCents).toBe(15_000);

		await db
			.update(schema.contracts)
			.set({ billingModel: 'included_hours', hourlyRateCents: 15_000 })
			.where(eq(schema.contracts.id, defaultContractId));
	});
});

describe('triageTicket', () => {
	it('sets priority, flips status to new, and snapshots SLA due dates', async () => {
		const ticket = await createTicket(db, { title: 'To be triaged', companyId, source: 'manual' });
		await triageTicket(db, ticket.id, 'critical');

		const updated = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id)).get();
		expect(updated?.status).toBe('new');
		expect(updated?.priority).toBe('critical');
		expect(updated?.prioritySource).toBe('manual');
		expect(updated?.responseDueAt).not.toBeNull();
	});

	it('rejects triaging a ticket that is not in triage status', async () => {
		const ticket = await createTicket(db, { title: 'Already triaged', companyId, source: 'manual' });
		await triageTicket(db, ticket.id, 'low');
		await expect(triageTicket(db, ticket.id, 'high')).rejects.toThrow('ticket is not in triage');
	});
});

describe('setStatus', () => {
	it('rejects an invalid transition (e.g. new -> closed directly)', async () => {
		const ticket = await createTicket(db, { title: 'Status test', companyId, source: 'integration', priority: 'low' });
		expect(ticket.status).toBe('new');
		await expect(setStatus(db, ticket.id, 'closed')).rejects.toThrow(/cannot transition/);
	});

	it('clears needsTechAttention when leaving waiting_on_client', async () => {
		const ticket = await createTicket(db, { title: 'Attention test', companyId, source: 'integration', priority: 'medium' });
		await setStatus(db, ticket.id, 'waiting_on_client');
		await markClientReplied(db, ticket.id, resourceId);

		const flagged = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id)).get();
		expect(flagged?.needsTechAttention).toBe(true);

		await setStatus(db, ticket.id, 'in_progress');
		const cleared = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id)).get();
		expect(cleared?.needsTechAttention).toBe(false);
	});

	it('sets resolvedAt and closedAt on the resolve/close path, and clears both on reopen', async () => {
		const ticket = await createTicket(db, { title: 'Lifecycle test', companyId, source: 'integration', priority: 'low' });
		await setStatus(db, ticket.id, 'resolved');
		let row = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id)).get();
		expect(row?.resolvedAt).not.toBeNull();
		expect(row?.closedAt).toBeNull();

		await setStatus(db, ticket.id, 'closed');
		row = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id)).get();
		expect(row?.closedAt).not.toBeNull();

		await setStatus(db, ticket.id, 'in_progress');
		row = await db.select().from(schema.tickets).where(eq(schema.tickets.id, ticket.id)).get();
		expect(row?.resolvedAt).toBeNull();
		expect(row?.closedAt).toBeNull();
	});
});
