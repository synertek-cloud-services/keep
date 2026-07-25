import { asc, desc, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import * as schema from './db/schema';

// Deliberately NOT derived from ticketColumns.ts's `sortable` flags — see
// the comment there. Keep this list and that file's flags in sync by hand.
export type TicketSortKey =
	| 'ticketNumber'
	| 'title'
	| 'company'
	| 'queue'
	| 'status'
	| 'priority'
	| 'assigned'
	| 'contact'
	| 'issueType'
	| 'source'
	| 'createdAt';

const SORT_KEYS = new Set<string>([
	'ticketNumber',
	'title',
	'company',
	'queue',
	'status',
	'priority',
	'assigned',
	'contact',
	'issueType',
	'source',
	'createdAt'
]);

export function isTicketSortKey(key: string | null): key is TicketSortKey {
	return !!key && SORT_KEYS.has(key);
}

// Severity order, not alphabetical — plain `ORDER BY priority` would sort
// 'critical','high','low','medium', which is wrong. NULL (untriaged tickets,
// no priority set yet — schema.tickets.priority is nullable) lands in the
// ELSE bucket at rank 5 — the lowest-severity end of the ranking, so it
// sorts last ascending (most severe first) and first descending, same as
// every other rank when the direction flips.
const PRIORITY_RANK = sql`CASE ${schema.tickets.priority}
	WHEN 'critical' THEN 1
	WHEN 'high' THEN 2
	WHEN 'medium' THEN 3
	WHEN 'low' THEN 4
	ELSE 5
END`;

const SORT_EXPRESSIONS: Record<TicketSortKey, AnyColumn | SQL> = {
	ticketNumber: schema.tickets.ticketNumber,
	title: schema.tickets.title,
	company: schema.companies.name,
	queue: schema.queues.name,
	status: schema.tickets.status,
	priority: PRIORITY_RANK,
	assigned: schema.users.displayName,
	contact: schema.contacts.name,
	issueType: schema.issueTypes.name,
	source: schema.tickets.source,
	createdAt: schema.tickets.createdAt
};

// Returns [primary order term, tiebreaker term]. The tiebreaker
// (ticketNumber, unique + not-null) guarantees deterministic row order even
// when many rows tie on the chosen column (e.g. sorting by status or
// queue) — without it, LIMIT/OFFSET pagination could silently skip or
// duplicate rows across two requests for the same page, since SQLite
// doesn't guarantee tied-row order is stable across separate queries.
export function resolveTicketOrderBy(sort: TicketSortKey, dir: 'asc' | 'desc'): [SQL, SQL] {
	const expr = SORT_EXPRESSIONS[sort];
	const primary = dir === 'asc' ? asc(expr) : desc(expr);
	return [primary, asc(schema.tickets.ticketNumber)];
}
