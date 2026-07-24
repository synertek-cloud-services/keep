import { and, desc, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import type { TicketStatus } from '$lib/sla';

const OPEN_STATUSES: TicketStatus[] = ['triage', 'new', 'in_progress', 'waiting_on_client', 'waiting_on_vendor'];

export const load: PageServerLoad = async ({ url, locals, platform }) => {
	const db = getDb(platform!);

	const queue = url.searchParams.get('queue');
	const status = url.searchParams.get('status');
	const priority = url.searchParams.get('priority');
	const issueType = url.searchParams.get('issueType');
	const assigned = url.searchParams.get('assigned');
	const unassigned = url.searchParams.get('unassigned') === '1';
	// "All Tickets" quick link uses all=1 to show every status/assignee; the
	// true default (no params at all) is "My Tickets" — assigned to the
	// current user, open statuses only.
	const all = url.searchParams.get('all') === '1';
	const mine = url.searchParams.get('mine') === '1' || (!all && !unassigned && !assigned && !status && !queue && !priority && !issueType);
	const needsAttention = url.searchParams.get('needsAttention') === '1';

	const conditions = [];
	if (queue) conditions.push(eq(schema.tickets.queueId, queue));
	if (status) conditions.push(eq(schema.tickets.status, status as TicketStatus));
	else if (!all) {
		// Default view (My Tickets / no explicit status filter) only shows open work.
	}
	if (priority) conditions.push(eq(schema.tickets.priority, priority as 'critical' | 'high' | 'medium' | 'low'));
	if (issueType) conditions.push(eq(schema.tickets.issueTypeId, issueType));
	if (unassigned) conditions.push(isNull(schema.tickets.assignedResourceId));
	else if (assigned) conditions.push(eq(schema.tickets.assignedResourceId, assigned));
	else if (mine) conditions.push(eq(schema.tickets.assignedResourceId, locals.user!.id));
	if (needsAttention) conditions.push(eq(schema.tickets.needsTechAttention, true));

	const rows = await db
		.select({
			id: schema.tickets.id,
			ticketNumber: schema.tickets.ticketNumber,
			title: schema.tickets.title,
			status: schema.tickets.status,
			priority: schema.tickets.priority,
			needsTechAttention: schema.tickets.needsTechAttention,
			assignedResourceId: schema.tickets.assignedResourceId,
			assignedResourceName: schema.users.displayName,
			companyName: schema.companies.name,
			queueName: schema.queues.name,
			slaClockStartedAt: schema.tickets.slaClockStartedAt,
			responseDueAt: schema.tickets.responseDueAt,
			resolutionDueAt: schema.tickets.resolutionDueAt,
			triageDueAt: schema.tickets.triageDueAt,
			createdAt: schema.tickets.createdAt
		})
		.from(schema.tickets)
		.leftJoin(schema.users, eq(schema.users.id, schema.tickets.assignedResourceId))
		.innerJoin(schema.companies, eq(schema.companies.id, schema.tickets.companyId))
		.innerJoin(schema.queues, eq(schema.queues.id, schema.tickets.queueId))
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(desc(schema.tickets.createdAt))
		.all();

	const filteredRows = status || all ? rows : rows.filter((t) => OPEN_STATUSES.includes(t.status as TicketStatus));

	const queues = await db.select().from(schema.queues).orderBy(schema.queues.name).all();
	const issueTypes = await db.select().from(schema.issueTypes).orderBy(schema.issueTypes.sortOrder).all();

	return {
		tickets: filteredRows,
		queues,
		issueTypes,
		filters: { queue, status, priority, issueType, unassigned, mine, needsAttention, all }
	};
};
