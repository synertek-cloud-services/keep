import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { DEFAULT_TIMEZONE, ORGANIZATION_SETTINGS_ID } from '$lib/server/settings';
import {
	DEFAULT_TICKET_WORKSPACE_LAYOUT,
	parseTicketWorkspaceLayout
} from '$lib/ticketWorkspace';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!);
	const settings = await db
		.select()
		.from(schema.organizationSettings)
		.where(eq(schema.organizationSettings.id, ORGANIZATION_SETTINGS_ID))
		.get();
	return {
		layout:
			parseTicketWorkspaceLayout(settings?.ticketWorkspaceLayout) ??
			structuredClone(DEFAULT_TICKET_WORKSPACE_LAYOUT)
	};
};

export const actions: Actions = {
	save: async ({ request, platform }) => {
		const form = await request.formData();
		const layout = parseTicketWorkspaceLayout(String(form.get('layout') ?? ''));
		if (!layout) return fail(400, { error: 'The workspace layout is invalid or incomplete.' });

		const db = getDb(platform!);
		const now = Math.floor(Date.now() / 1000);
		await db
			.insert(schema.organizationSettings)
			.values({
				id: ORGANIZATION_SETTINGS_ID,
				timezone: DEFAULT_TIMEZONE,
				ticketWorkspaceLayout: JSON.stringify(layout),
				updatedAt: now
			})
			.onConflictDoUpdate({
				target: schema.organizationSettings.id,
				set: { ticketWorkspaceLayout: JSON.stringify(layout), updatedAt: now }
			});
		return { success: true };
	}
};
