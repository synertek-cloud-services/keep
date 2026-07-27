import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { DEFAULT_TIMEZONE, ORGANIZATION_SETTINGS_ID } from '$lib/server/settings';
import { isValidIanaTimezone } from '$lib/timezones';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!);
	const settings = await db
		.select()
		.from(schema.organizationSettings)
		.where(eq(schema.organizationSettings.id, ORGANIZATION_SETTINGS_ID))
		.get();
	return { timezone: settings?.timezone ?? DEFAULT_TIMEZONE };
};

export const actions: Actions = {
	save: async ({ request, platform }) => {
		const form = await request.formData();
		const timezone = String(form.get('timezone') ?? '').trim();
		if (!timezone || !isValidIanaTimezone(timezone)) {
			return fail(400, { error: 'Enter a valid IANA timezone, such as America/Los_Angeles.' });
		}

		const db = getDb(platform!);
		await db
			.insert(schema.organizationSettings)
			.values({
				id: ORGANIZATION_SETTINGS_ID,
				timezone,
				updatedAt: Math.floor(Date.now() / 1000)
			})
			.onConflictDoUpdate({
				target: schema.organizationSettings.id,
				set: { timezone, updatedAt: Math.floor(Date.now() / 1000) }
			});
		return { success: true };
	}
};
