import { describe, expect, it } from 'vitest';
import {
	DEFAULT_TICKET_WORKSPACE_LAYOUT,
	parseTicketWorkspaceLayout,
	resolveTicketWorkspaceLayout,
	serializeTicketWorkspaceLayout
} from './ticketWorkspace';

describe('ticket workspace layouts', () => {
	it('accepts and serializes the complete default layout', () => {
		expect(parseTicketWorkspaceLayout(JSON.stringify(DEFAULT_TICKET_WORKSPACE_LAYOUT))).toEqual(
			DEFAULT_TICKET_WORKSPACE_LAYOUT
		);
		expect(serializeTicketWorkspaceLayout(DEFAULT_TICKET_WORKSPACE_LAYOUT)).toBe(
			JSON.stringify(DEFAULT_TICKET_WORKSPACE_LAYOUT)
		);
	});

	it('rejects duplicate, missing, and unknown widgets', () => {
		const duplicate = structuredClone(DEFAULT_TICKET_WORKSPACE_LAYOUT);
		duplicate.columns.right.push('details');
		expect(parseTicketWorkspaceLayout(duplicate)).toBeNull();

		const missing = structuredClone(DEFAULT_TICKET_WORKSPACE_LAYOUT);
		missing.columns.center = missing.columns.center.filter((id) => id !== 'details');
		expect(parseTicketWorkspaceLayout(missing)).toBeNull();

		const unknown = structuredClone(DEFAULT_TICKET_WORKSPACE_LAYOUT) as unknown as {
			columns: { left: string[] };
		};
		unknown.columns.left.push('unknown');
		expect(parseTicketWorkspaceLayout(unknown)).toBeNull();

		const requiredHidden = structuredClone(DEFAULT_TICKET_WORKSPACE_LAYOUT);
		requiredHidden.columns.center = requiredHidden.columns.center.filter((id) => id !== 'details');
		requiredHidden.hidden.push('details');
		expect(parseTicketWorkspaceLayout(requiredHidden)).toBeNull();
	});

	it('uses user, organization, then application defaults', () => {
		const organization = structuredClone(DEFAULT_TICKET_WORKSPACE_LAYOUT);
		organization.preset = '3-7-2';
		const user = structuredClone(DEFAULT_TICKET_WORKSPACE_LAYOUT);
		user.preset = '2-7-3';

		expect(resolveTicketWorkspaceLayout(user, organization).preset).toBe('2-7-3');
		expect(resolveTicketWorkspaceLayout(null, organization).preset).toBe('3-7-2');
		expect(resolveTicketWorkspaceLayout(null, null)).toEqual(DEFAULT_TICKET_WORKSPACE_LAYOUT);
	});
});
