export const TICKET_WORKSPACE_PRESETS = {
	'3-6-3': 'Balanced · 3 / 6 / 3',
	'3-7-2': 'Wide center · 3 / 7 / 2',
	'2-7-3': 'Wide center, right rail · 2 / 7 / 3'
} as const;

export type TicketWorkspacePreset = keyof typeof TICKET_WORKSPACE_PRESETS;
export type TicketWorkspaceColumn = 'left' | 'center' | 'right';

export const TICKET_WORKSPACE_WIDGETS = [
	{ id: 'customer', title: 'Customer & Contract', optional: false },
	{ id: 'assignment', title: 'Assignment', optional: false },
	{ id: 'classification', title: 'Classification', optional: true },
	{ id: 'details', title: 'Ticket Details', optional: false },
	{ id: 'activity', title: 'Activity & Notes', optional: false },
	{ id: 'time-history', title: 'Time Entry History', optional: true },
	{ id: 'status-sla', title: 'Status & SLA', optional: false },
	{ id: 'log-time', title: 'Time Summary', optional: true }
] as const;

export type TicketWorkspaceWidgetId = (typeof TICKET_WORKSPACE_WIDGETS)[number]['id'];

export interface TicketWorkspaceLayout {
	version: 1;
	preset: TicketWorkspacePreset;
	columns: Record<TicketWorkspaceColumn, TicketWorkspaceWidgetId[]>;
	hidden: TicketWorkspaceWidgetId[];
}

export const DEFAULT_TICKET_WORKSPACE_LAYOUT: TicketWorkspaceLayout = {
	version: 1,
	preset: '3-6-3',
	columns: {
		left: ['customer', 'assignment', 'classification'],
		center: ['details', 'activity', 'time-history'],
		right: ['status-sla', 'log-time']
	},
	hidden: []
};

const widgetIds = new Set<string>(TICKET_WORKSPACE_WIDGETS.map((widget) => widget.id));
const requiredWidgetIds = new Set<string>(
	TICKET_WORKSPACE_WIDGETS.filter((widget) => !widget.optional).map((widget) => widget.id)
);
const columnIds: TicketWorkspaceColumn[] = ['left', 'center', 'right'];

export function parseTicketWorkspaceLayout(value: unknown): TicketWorkspaceLayout | null {
	try {
		const raw = typeof value === 'string' ? JSON.parse(value) : value;
		if (!raw || typeof raw !== 'object') return null;
		const candidate = raw as Partial<TicketWorkspaceLayout>;
		if (candidate.version !== 1 || !candidate.preset || !(candidate.preset in TICKET_WORKSPACE_PRESETS)) return null;
		if (!candidate.columns || typeof candidate.columns !== 'object' || !Array.isArray(candidate.hidden)) return null;

		const seen = new Set<string>();
		const parsedColumns = {} as Record<TicketWorkspaceColumn, TicketWorkspaceWidgetId[]>;
		for (const column of columnIds) {
			const items = candidate.columns[column];
			if (!Array.isArray(items)) return null;
			parsedColumns[column] = [];
			for (const item of items) {
				if (typeof item !== 'string' || !widgetIds.has(item) || seen.has(item)) return null;
				seen.add(item);
				parsedColumns[column].push(item as TicketWorkspaceWidgetId);
			}
		}

		const hidden: TicketWorkspaceWidgetId[] = [];
		for (const item of candidate.hidden) {
			if (
				typeof item !== 'string' ||
				!widgetIds.has(item) ||
				requiredWidgetIds.has(item) ||
				seen.has(item)
			)
				return null;
			seen.add(item);
			hidden.push(item as TicketWorkspaceWidgetId);
		}
		if (seen.size !== widgetIds.size) return null;
		return { version: 1, preset: candidate.preset, columns: parsedColumns, hidden };
	} catch {
		return null;
	}
}

export function resolveTicketWorkspaceLayout(userValue: unknown, organizationValue: unknown): TicketWorkspaceLayout {
	return (
		parseTicketWorkspaceLayout(userValue) ??
		parseTicketWorkspaceLayout(organizationValue) ??
		structuredClone(DEFAULT_TICKET_WORKSPACE_LAYOUT)
	);
}

export function serializeTicketWorkspaceLayout(value: unknown): string | null {
	const layout = parseTicketWorkspaceLayout(value);
	return layout ? JSON.stringify(layout) : null;
}
