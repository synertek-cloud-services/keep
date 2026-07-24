// PURE — no DB, no imports from lib/server. Shared verbatim between server
// logic (lib/server/tickets.ts) and the client-side SlaCountdown component,
// so a live-ticking countdown badge always agrees with the server's judgment
// about whether a ticket is on track, at risk, or breached.

export type TicketStatus =
	| 'triage'
	| 'new'
	| 'in_progress'
	| 'waiting_on_client'
	| 'waiting_on_vendor'
	| 'resolved'
	| 'closed';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export const TICKET_STATUSES: TicketStatus[] = [
	'triage',
	'new',
	'in_progress',
	'waiting_on_client',
	'waiting_on_vendor',
	'resolved',
	'closed'
];

export const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];

// `triage` has no direct transitions — leaving it must go through the
// dedicated triage action (see lib/server/tickets.ts triageTicket()), which
// is the concrete enforcement of "a ticket cannot leave Triage without a
// priority set." `resolved`/`closed` can both reopen back to `in_progress`.
export const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
	triage: [],
	new: ['in_progress', 'waiting_on_client', 'waiting_on_vendor', 'resolved'],
	in_progress: ['waiting_on_client', 'waiting_on_vendor', 'resolved'],
	waiting_on_client: ['in_progress', 'waiting_on_vendor', 'resolved'],
	waiting_on_vendor: ['in_progress', 'waiting_on_client', 'resolved'],
	resolved: ['closed', 'in_progress'],
	closed: ['in_progress']
};

export function nextValidStatuses(current: TicketStatus): TicketStatus[] {
	return TRANSITIONS[current];
}

export function canLeaveTriage(priority: Priority | null | undefined): priority is Priority {
	return priority === 'critical' || priority === 'high' || priority === 'medium' || priority === 'low';
}

export function computeTriageDueAt(nowSeconds: number, triageMinutes: number): number {
	return nowSeconds + triageMinutes * 60;
}

export interface PriorityWindow {
	responseMinutes: number;
	resolutionMinutes: number;
}

export interface SlaClocks {
	slaClockStartedAt: number;
	responseDueAt: number;
	resolutionDueAt: number;
}

// Snapshotted at a single point in time (triage-exit, or ticket creation for
// Integration-sourced tickets) — the caller persists this onto the ticket
// row. Later edits to the SLA policy must NOT cause these to be recomputed;
// that's the invariant that makes existing tickets' due dates stable.
export function computeResponseResolutionDueAt(nowSeconds: number, row: PriorityWindow): SlaClocks {
	return {
		slaClockStartedAt: nowSeconds,
		responseDueAt: nowSeconds + row.responseMinutes * 60,
		resolutionDueAt: nowSeconds + row.resolutionMinutes * 60
	};
}

export type SlaStateValue = 'none' | 'on_track' | 'at_risk' | 'breached';

// Deliberately a continuous 24/7 clock — no business-hours/holiday calendar.
// A v1 simplification consistent with "pay-as-you-need, no bloat," not an
// oversight: a business-hours calendar only changes how due dates are
// *computed* upstream, not this function's job of comparing now vs. a
// already-computed due date.
export function slaState(
	nowSeconds: number,
	startedAt: number | null | undefined,
	dueAt: number | null | undefined
): SlaStateValue {
	if (startedAt == null || dueAt == null) return 'none';
	if (nowSeconds >= dueAt) return 'breached';

	const totalWindow = dueAt - startedAt;
	const remaining = dueAt - nowSeconds;
	if (totalWindow <= 0 || remaining / totalWindow <= 0.25) return 'at_risk';
	return 'on_track';
}
