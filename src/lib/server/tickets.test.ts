import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { applyMigrationsForTest } from './db/testMigrate';
import * as schema from './db/schema';
import { createTicket, triageTicket, setStatus, markClientReplied } from './tickets';

const db = drizzle(env.DB, { schema });
let companyId: string;
let resourceId: string;

beforeAll(async () => {
	await applyMigrationsForTest(env.DB);

	const now = Math.floor(Date.now() / 1000);
	companyId = crypto.randomUUID();
	resourceId = crypto.randomUUID();
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
});

describe('createTicket', () => {
	it('manual source lands in triage with priority=null and a triageDueAt set', async () => {
		const ticket = await createTicket(db, { title: 'Manual ticket', companyId, source: 'manual' });
		expect(ticket.status).toBe('triage');
		expect(ticket.priority).toBeNull();
		expect(ticket.prioritySource).toBeNull();
		expect(ticket.triageDueAt).not.toBeNull();
		expect(ticket.responseDueAt).toBeNull();
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
