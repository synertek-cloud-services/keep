import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import type { TicketStatus } from '$lib/sla';
import { TICKET_COLUMNS, resolveVisibleColumns, type TicketColumnKey } from '$lib/ticketColumns';
import { isPageSize, resolvePageSize } from '$lib/ticketPageSize';
import { updateTicketColumnPrefs, updateTicketPageSize } from '$lib/server/users';
import { isTicketSortKey, resolveTicketOrderBy } from '$lib/server/ticketSort';

const OPEN_STATUSES: TicketStatus[] = ['triage', 'new', 'in_progress', 'waiting_on_client', 'waiting_on_vendor'];

export const load: PageServerLoad = async ({ url, locals, platform }) => {
	const db = getDb(platform!);

	const currentUser = await db
		.select({ ticketColumnPrefs: schema.users.ticketColumnPrefs, ticketPageSize: schema.users.ticketPageSize })
		.from(schema.users)
		.where(eq(schema.users.id, locals.user!.id))
		.get();
	const visibleColumns = resolveVisibleColumns(currentUser?.ticketColumnPrefs);
	const pageSize = resolvePageSize(url.searchParams.get('pageSize'), currentUser?.ticketPageSize);

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

	// Falls back to today's hardcoded default (createdAt desc) — any existing
	// bookmarked/shared /tickets URL with no `sort` param renders unchanged.
	const sortParam = url.searchParams.get('sort');
	const dirParam = url.searchParams.get('dir');
	const sort = isTicketSortKey(sortParam) ? sortParam : 'createdAt';
	const dir: 'asc' | 'desc' =
		dirParam === 'asc' ? 'asc' : dirParam === 'desc' ? 'desc' : isTicketSortKey(sortParam) ? 'asc' : 'desc';

	// Any non-positive-integer input (missing, "0", "-1", "abc", "2.5") falls
	// back to page 1 rather than erroring.
	const requestedPage = Number(url.searchParams.get('page'));
	const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

	const conditions = [];
	if (queue) conditions.push(eq(schema.tickets.queueId, queue));
	if (status) conditions.push(eq(schema.tickets.status, status as TicketStatus));
	else if (!all) conditions.push(inArray(schema.tickets.status, OPEN_STATUSES));
	if (priority) conditions.push(eq(schema.tickets.priority, priority as 'critical' | 'high' | 'medium' | 'low'));
	if (issueType) conditions.push(eq(schema.tickets.issueTypeId, issueType));
	if (unassigned) conditions.push(isNull(schema.tickets.assignedResourceId));
	else if (assigned) conditions.push(eq(schema.tickets.assignedResourceId, assigned));
	else if (mine) conditions.push(eq(schema.tickets.assignedResourceId, locals.user!.id));
	if (needsAttention) conditions.push(eq(schema.tickets.needsTechAttention, true));

	const whereClause = conditions.length ? and(...conditions) : undefined;

	// Every condition above references only schema.tickets columns, so the
	// count query needs none of the main query's 5 joins.
	const countRow = await db.select({ n: sql<number>`count(*)` }).from(schema.tickets).where(whereClause).get();
	const total = countRow?.n ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	// Clamp rather than render empty: if a filter change shrinks the result
	// set out from under a deep page number, show the last valid page. Not
	// redirecting the URL back to the clamped number — the address bar can
	// stay "stale" while the rendered data/controls reflect reality; a
	// redirect would cost an extra round trip for a rare edge case.
	const currentPage = Math.min(page, totalPages);

	const [primaryOrder, tiebreakOrder] = resolveTicketOrderBy(sort, dir);

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
			contactName: schema.contacts.name,
			issueTypeName: schema.issueTypes.name,
			source: schema.tickets.source,
			slaClockStartedAt: schema.tickets.slaClockStartedAt,
			responseDueAt: schema.tickets.responseDueAt,
			resolutionDueAt: schema.tickets.resolutionDueAt,
			triageDueAt: schema.tickets.triageDueAt,
			createdAt: schema.tickets.createdAt
		})
		.from(schema.tickets)
		.leftJoin(schema.users, eq(schema.users.id, schema.tickets.assignedResourceId))
		.leftJoin(schema.contacts, eq(schema.contacts.id, schema.tickets.contactId))
		.leftJoin(schema.issueTypes, eq(schema.issueTypes.id, schema.tickets.issueTypeId))
		.innerJoin(schema.companies, eq(schema.companies.id, schema.tickets.companyId))
		.innerJoin(schema.queues, eq(schema.queues.id, schema.tickets.queueId))
		.where(whereClause)
		.orderBy(primaryOrder, tiebreakOrder)
		.limit(pageSize)
		.offset((currentPage - 1) * pageSize)
		.all();

	const queues = await db.select().from(schema.queues).orderBy(schema.queues.name).all();
	const issueTypes = await db.select().from(schema.issueTypes).orderBy(schema.issueTypes.sortOrder).all();

	return {
		tickets: rows,
		queues,
		issueTypes,
		visibleColumns,
		filters: { queue, status, priority, issueType, unassigned, mine, needsAttention, all },
		sort,
		dir,
		page: currentPage,
		pageSize,
		total,
		totalPages
	};
};

export const actions: Actions = {
	saveColumns: async ({ request, locals, platform }) => {
		const form = await request.formData();
		let keys: string[] = [];
		try {
			keys = JSON.parse(String(form.get('columns') ?? '[]'));
		} catch {
			// falls through to empty
		}
		const validKeys = new Set<string>(TICKET_COLUMNS.map((c) => c.key));
		const columns = keys.filter((k): k is TicketColumnKey => validKeys.has(k));

		const db = getDb(platform!);
		await updateTicketColumnPrefs(db, locals.user!.id, columns);
		return { success: true };
	},

	savePageSize: async ({ request, locals, platform }) => {
		const form = await request.formData();
		const n = Number(form.get('pageSize'));
		if (!Number.isInteger(n) || !isPageSize(n)) return { success: false };

		const db = getDb(platform!);
		await updateTicketPageSize(db, locals.user!.id, n);
		return { success: true };
	}
};
