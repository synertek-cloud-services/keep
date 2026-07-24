import { and, desc, eq, inArray, isNull, isNotNull, sql } from 'drizzle-orm';
import type { Db } from './db';
import * as schema from './db/schema';
import { slaState, type TicketStatus } from '$lib/sla';

const OPEN_STATUSES: TicketStatus[] = ['triage', 'new', 'in_progress', 'waiting_on_client', 'waiting_on_vendor'];

// Widget type catalog — shared by the "+ Add widget" picker and the render
// switch in (app)/+page.svelte. `shape` selects which generic rendering
// primitive (Big Number / Chart / List) a widget uses.
export const WIDGET_TYPES = [
	{ type: 'unassigned_count', title: 'Unassigned Tickets', shape: 'big_number' },
	{ type: 'untriaged_count', title: 'Untriaged Tickets', shape: 'big_number' },
	{ type: 'sla_breaches_today', title: 'SLA Breaches Today', shape: 'big_number' },
	{ type: 'needs_attention_count', title: 'Needs Attention', shape: 'big_number' },
	{ type: 'open_by_status', title: 'Open Tickets by Status', shape: 'chart' },
	{ type: 'open_by_priority', title: 'Open Tickets by Priority', shape: 'chart' },
	{ type: 'open_by_queue', title: 'Open Tickets by Queue', shape: 'chart' },
	{ type: 'oldest_open_tickets', title: 'Oldest Open Tickets', shape: 'list' },
	{ type: 'tickets_per_tech', title: 'Tickets per Tech', shape: 'list' },
	{ type: 'sla_at_risk_tickets', title: 'SLA At-Risk Tickets', shape: 'list' }
] as const;

function startOfUtcDay(nowSeconds: number): number {
	return Math.floor(nowSeconds / 86400) * 86400;
}

export interface BigNumbers {
	unassignedCount: number;
	untriagedCount: number;
	oldestUntriagedAgeMinutes: number | null;
	slaBreachesToday: number;
	needsAttentionCount: number;
}

export async function bigNumbers(db: Db): Promise<BigNumbers> {
	const now = Math.floor(Date.now() / 1000);
	const todayStart = startOfUtcDay(now);

	const unassigned = await db
		.select({ n: sql<number>`count(*)` })
		.from(schema.tickets)
		.where(and(inArray(schema.tickets.status, OPEN_STATUSES), isNull(schema.tickets.assignedResourceId)))
		.get();

	const untriaged = await db
		.select({ n: sql<number>`count(*)`, oldest: sql<number | null>`min(${schema.tickets.createdAt})` })
		.from(schema.tickets)
		.where(eq(schema.tickets.status, 'triage'))
		.get();

	// Scoped to the resolution clock specifically (the more consequential
	// deadline) breaching within today's UTC calendar day — response-clock
	// breaches and slow-burning at-risk tickets are covered by the SLA
	// At-Risk list widget instead, deliberately kept simple here.
	const breachesToday = await db
		.select({ n: sql<number>`count(*)` })
		.from(schema.tickets)
		.where(
			and(
				inArray(schema.tickets.status, OPEN_STATUSES),
				isNotNull(schema.tickets.resolutionDueAt),
				sql`${schema.tickets.resolutionDueAt} < ${now}`,
				sql`${schema.tickets.resolutionDueAt} >= ${todayStart}`
			)
		)
		.get();

	const needsAttention = await db
		.select({ n: sql<number>`count(*)` })
		.from(schema.tickets)
		.where(and(inArray(schema.tickets.status, OPEN_STATUSES), eq(schema.tickets.needsTechAttention, true)))
		.get();

	return {
		unassignedCount: unassigned?.n ?? 0,
		untriagedCount: untriaged?.n ?? 0,
		oldestUntriagedAgeMinutes: untriaged?.oldest != null ? Math.floor((now - untriaged.oldest) / 60) : null,
		slaBreachesToday: breachesToday?.n ?? 0,
		needsAttentionCount: needsAttention?.n ?? 0
	};
}

export interface LabeledCount {
	label: string;
	value: number;
}

const STATUS_LABELS: Record<string, string> = {
	triage: 'Triage',
	new: 'New',
	in_progress: 'In Progress',
	waiting_on_client: 'Waiting on Client',
	waiting_on_vendor: 'Waiting on Vendor'
};

export async function openByStatus(db: Db): Promise<LabeledCount[]> {
	const rows = await db
		.select({ status: schema.tickets.status, n: sql<number>`count(*)` })
		.from(schema.tickets)
		.where(inArray(schema.tickets.status, OPEN_STATUSES))
		.groupBy(schema.tickets.status)
		.all();
	return OPEN_STATUSES.map((status) => ({
		label: STATUS_LABELS[status],
		value: rows.find((r) => r.status === status)?.n ?? 0
	}));
}

export async function openByPriority(db: Db): Promise<LabeledCount[]> {
	const rows = await db
		.select({ priority: schema.tickets.priority, n: sql<number>`count(*)` })
		.from(schema.tickets)
		.where(inArray(schema.tickets.status, OPEN_STATUSES))
		.groupBy(schema.tickets.priority)
		.all();
	const order = ['critical', 'high', 'medium', 'low'];
	const named = order.map((p) => ({
		label: p.charAt(0).toUpperCase() + p.slice(1),
		value: rows.find((r) => r.priority === p)?.n ?? 0
	}));
	const unset = rows.find((r) => r.priority == null)?.n ?? 0;
	return unset > 0 ? [...named, { label: 'Unset (Triage)', value: unset }] : named;
}

export async function openByQueue(db: Db): Promise<LabeledCount[]> {
	const rows = await db
		.select({ queueName: schema.queues.name, n: sql<number>`count(*)` })
		.from(schema.tickets)
		.innerJoin(schema.queues, eq(schema.queues.id, schema.tickets.queueId))
		.where(inArray(schema.tickets.status, OPEN_STATUSES))
		.groupBy(schema.queues.name)
		.all();
	return rows.map((r) => ({ label: r.queueName, value: r.n })).sort((a, b) => b.value - a.value);
}

export interface TicketListRow {
	id: string;
	ticketNumber: string;
	title: string;
	companyName: string;
	createdAt: number;
}

export async function oldestOpenTickets(db: Db, limit = 10): Promise<TicketListRow[]> {
	return db
		.select({
			id: schema.tickets.id,
			ticketNumber: schema.tickets.ticketNumber,
			title: schema.tickets.title,
			companyName: schema.companies.name,
			createdAt: schema.tickets.createdAt
		})
		.from(schema.tickets)
		.innerJoin(schema.companies, eq(schema.companies.id, schema.tickets.companyId))
		.where(inArray(schema.tickets.status, OPEN_STATUSES))
		.orderBy(schema.tickets.createdAt)
		.limit(limit)
		.all();
}

export interface TechWorkload {
	resourceName: string;
	count: number;
}

export async function ticketsPerTech(db: Db): Promise<TechWorkload[]> {
	const rows = await db
		.select({ name: schema.users.displayName, email: schema.users.email, n: sql<number>`count(*)` })
		.from(schema.tickets)
		.innerJoin(schema.users, eq(schema.users.id, schema.tickets.assignedResourceId))
		.where(inArray(schema.tickets.status, OPEN_STATUSES))
		.groupBy(schema.tickets.assignedResourceId)
		.all();
	return rows.map((r) => ({ resourceName: r.name ?? r.email, count: r.n })).sort((a, b) => b.count - a.count);
}

export interface SlaAtRiskRow extends TicketListRow {
	slaLabel: string;
	dueAt: number;
}

// Computed in JS via the shared slaState() rather than in SQL — the 25%-
// remaining-window threshold isn't a clean SQL predicate, and this reuses
// the exact same logic the client-side SlaCountdown uses, so this list and
// a ticket's own countdown badge can never disagree about at-risk/breached.
export async function slaAtRiskTickets(db: Db, limit = 10): Promise<SlaAtRiskRow[]> {
	const now = Math.floor(Date.now() / 1000);
	const rows = await db
		.select({
			id: schema.tickets.id,
			ticketNumber: schema.tickets.ticketNumber,
			title: schema.tickets.title,
			companyName: schema.companies.name,
			status: schema.tickets.status,
			createdAt: schema.tickets.createdAt,
			triageDueAt: schema.tickets.triageDueAt,
			slaClockStartedAt: schema.tickets.slaClockStartedAt,
			responseDueAt: schema.tickets.responseDueAt,
			resolutionDueAt: schema.tickets.resolutionDueAt,
			firstResponseAt: schema.tickets.firstResponseAt
		})
		.from(schema.tickets)
		.innerJoin(schema.companies, eq(schema.companies.id, schema.tickets.companyId))
		.where(inArray(schema.tickets.status, OPEN_STATUSES))
		.all();

	const candidates: SlaAtRiskRow[] = [];
	for (const t of rows) {
		if (t.status === 'triage') {
			const state = slaState(now, t.createdAt, t.triageDueAt);
			if ((state === 'at_risk' || state === 'breached') && t.triageDueAt != null) {
				candidates.push({ id: t.id, ticketNumber: t.ticketNumber, title: t.title, companyName: t.companyName, createdAt: t.createdAt, slaLabel: 'Triage', dueAt: t.triageDueAt });
			}
			continue;
		}
		if (!t.firstResponseAt) {
			const state = slaState(now, t.slaClockStartedAt, t.responseDueAt);
			if ((state === 'at_risk' || state === 'breached') && t.responseDueAt != null) {
				candidates.push({ id: t.id, ticketNumber: t.ticketNumber, title: t.title, companyName: t.companyName, createdAt: t.createdAt, slaLabel: 'Response', dueAt: t.responseDueAt });
				continue;
			}
		}
		const resState = slaState(now, t.slaClockStartedAt, t.resolutionDueAt);
		if ((resState === 'at_risk' || resState === 'breached') && t.resolutionDueAt != null) {
			candidates.push({ id: t.id, ticketNumber: t.ticketNumber, title: t.title, companyName: t.companyName, createdAt: t.createdAt, slaLabel: 'Resolution', dueAt: t.resolutionDueAt });
		}
	}

	return candidates.sort((a, b) => a.dueAt - b.dueAt).slice(0, limit);
}

export interface DashboardData {
	bigNumbers: BigNumbers;
	charts: {
		openByStatus: LabeledCount[];
		openByPriority: LabeledCount[];
		openByQueue: LabeledCount[];
	};
	lists: {
		oldestOpenTickets: TicketListRow[];
		ticketsPerTech: TechWorkload[];
		slaAtRiskTickets: SlaAtRiskRow[];
	};
}

export async function loadDashboardData(db: Db): Promise<DashboardData> {
	const [bn, byStatus, byPriority, byQueue, oldest, workload, atRisk] = await Promise.all([
		bigNumbers(db),
		openByStatus(db),
		openByPriority(db),
		openByQueue(db),
		oldestOpenTickets(db),
		ticketsPerTech(db),
		slaAtRiskTickets(db)
	]);

	return {
		bigNumbers: bn,
		charts: { openByStatus: byStatus, openByPriority: byPriority, openByQueue: byQueue },
		lists: { oldestOpenTickets: oldest, ticketsPerTech: workload, slaAtRiskTickets: atRisk }
	};
}
