// Ticket-list page-size catalog. Mirrors the fixed-catalog idiom used by
// TICKET_COLUMNS/NAV_SECTIONS/WIDGET_TYPES elsewhere in this codebase.

export const PAGE_SIZE_OPTIONS = [15, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 25;

export function isPageSize(n: number): n is PageSize {
	return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n);
}

// Resolves the effective page size for a request: an explicit URL override
// wins (lets a one-off view differ without changing the saved default),
// then the user's saved preference, then the default. Both inputs are
// defensively validated against the known option set — never trust an
// arbitrary query-string number or a stale DB value into a raw LIMIT.
export function resolvePageSize(urlValue: string | null, savedPref: number | null | undefined): PageSize {
	const urlNum = Number(urlValue);
	if (urlValue && Number.isInteger(urlNum) && isPageSize(urlNum)) return urlNum;
	if (savedPref != null && isPageSize(savedPref)) return savedPref;
	return DEFAULT_PAGE_SIZE;
}
