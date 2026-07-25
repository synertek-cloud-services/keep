// Ticket-list column catalog. Mirrors the WIDGET_TYPES/NAV_SECTIONS
// "const array of typed objects with a stable key" idiom already
// established in this codebase.

export const TICKET_COLUMNS = [
	{ key: 'ticketNumber', label: 'Ticket #', sortable: true },
	{ key: 'title', label: 'Title', sortable: true },
	{ key: 'company', label: 'Company', sortable: true },
	{ key: 'queue', label: 'Queue', sortable: true },
	{ key: 'status', label: 'Status', sortable: true },
	{ key: 'priority', label: 'Priority', sortable: true },
	// Not sortable: SLA state is computed client-side per row (rowSlaState()
	// in +page.svelte branches on ticket status — triage compares against
	// triageDueAt, everything else against resolutionDueAt) via the pure
	// slaState() in $lib/sla.ts. No single stored column to ORDER BY without
	// reimplementing that branching as a SQL CASE — not worth it for one column.
	{ key: 'sla', label: 'SLA', sortable: false },
	{ key: 'assigned', label: 'Assigned', sortable: true },
	{ key: 'contact', label: 'Contact', sortable: true },
	{ key: 'issueType', label: 'Issue Type', sortable: true },
	{ key: 'source', label: 'Source', sortable: true },
	{ key: 'createdAt', label: 'Created', sortable: true }
] as const;

export type TicketColumnKey = (typeof TICKET_COLUMNS)[number]['key'];

// Exactly today's 8 columns, in today's order — this feature is zero-visual-
// change for anyone who never opens the chooser.
export const DEFAULT_TICKET_COLUMNS: TicketColumnKey[] = [
	'ticketNumber',
	'title',
	'company',
	'queue',
	'status',
	'priority',
	'sla',
	'assigned'
];

const VALID_KEYS = new Set<string>(TICKET_COLUMNS.map((c) => c.key));

// Defensive: silently drops unknown keys (e.g. a future catalog change
// removes one) and falls back to the default if the result would be empty
// or the stored value is missing/malformed — never renders zero columns.
export function resolveVisibleColumns(prefsJson: string | null | undefined): TicketColumnKey[] {
	if (!prefsJson) return DEFAULT_TICKET_COLUMNS;
	try {
		const parsed = JSON.parse(prefsJson);
		if (!Array.isArray(parsed)) return DEFAULT_TICKET_COLUMNS;
		const cleaned = parsed.filter((k): k is TicketColumnKey => typeof k === 'string' && VALID_KEYS.has(k));
		return cleaned.length ? cleaned : DEFAULT_TICKET_COLUMNS;
	} catch {
		return DEFAULT_TICKET_COLUMNS;
	}
}
