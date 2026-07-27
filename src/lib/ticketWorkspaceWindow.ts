export function openTicketWorkspace(ticketId: string): void {
	const width = Math.min(1600, Math.max(1100, window.screen.availWidth - 80));
	const height = Math.min(1200, Math.max(760, window.screen.availHeight - 80));
	window.open(
		`/tickets/${encodeURIComponent(ticketId)}`,
		'_blank',
		`popup=yes,noopener,noreferrer,width=${width},height=${height},left=40,top=40`
	);
}
