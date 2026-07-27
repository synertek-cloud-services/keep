import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { DEFAULT_TIMEZONE, ORGANIZATION_SETTINGS_ID } from '$lib/server/settings';
import { isValidIanaTimezone } from '$lib/timezones';
import {
	BILLING_ROUNDING_INCREMENTS,
	DEFAULT_BUSINESS_DAYS,
	isValidBusinessSchedule,
	parseBusinessDays,
	TIME_ENTRY_INCREMENTS
} from '$lib/timeEntryBilling';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!);
	const settings = await db
		.select()
		.from(schema.organizationSettings)
		.where(eq(schema.organizationSettings.id, ORGANIZATION_SETTINGS_ID))
		.get();
	return {
		timezone: settings?.timezone ?? DEFAULT_TIMEZONE,
		businessDays: parseBusinessDays(settings?.businessDays),
		businessStartMinute: settings?.businessStartMinute ?? 480,
		businessEndMinute: settings?.businessEndMinute ?? 1080,
		timeEntryIncrementMinutes: settings?.timeEntryIncrementMinutes ?? 5,
		billingRoundingMinutes: settings?.billingRoundingMinutes ?? 15,
		allowBillingOffset: settings?.allowBillingOffset ?? true
	};
};

export const actions: Actions = {
	save: async ({ request, platform }) => {
		const form = await request.formData();
		const timezone = String(form.get('timezone') ?? '').trim();
		const businessDays = form.getAll('businessDays').map(Number);
		const businessStartMinute = Number(form.get('businessStartMinute'));
		const businessEndMinute = Number(form.get('businessEndMinute'));
		const timeEntryIncrementMinutes = Number(form.get('timeEntryIncrementMinutes'));
		const billingRoundingMinutes = Number(form.get('billingRoundingMinutes'));
		if (!timezone || !isValidIanaTimezone(timezone)) {
			return fail(400, { error: 'Enter a valid IANA timezone, such as America/Los_Angeles.' });
		}
		if (!isValidBusinessSchedule(businessDays, businessStartMinute, businessEndMinute))
			return fail(400, { error: 'Choose at least one working day and a valid business-hours range.' });
		if (!TIME_ENTRY_INCREMENTS.includes(timeEntryIncrementMinutes as never))
			return fail(400, { error: 'Choose a supported time-entry increment.' });
		if (!BILLING_ROUNDING_INCREMENTS.includes(billingRoundingMinutes as never))
			return fail(400, { error: 'Choose a supported billing rounding increment.' });

		const db = getDb(platform!);
		await db
			.insert(schema.organizationSettings)
			.values({
				id: ORGANIZATION_SETTINGS_ID,
				timezone,
				businessDays: JSON.stringify(businessDays.length ? businessDays : DEFAULT_BUSINESS_DAYS),
				businessStartMinute,
				businessEndMinute,
				timeEntryIncrementMinutes,
				billingRoundingMinutes,
				allowBillingOffset: form.get('allowBillingOffset') === 'on',
				updatedAt: Math.floor(Date.now() / 1000)
			})
			.onConflictDoUpdate({
				target: schema.organizationSettings.id,
				set: {
					timezone,
					businessDays: JSON.stringify(businessDays),
					businessStartMinute,
					businessEndMinute,
					timeEntryIncrementMinutes,
					billingRoundingMinutes,
					allowBillingOffset: form.get('allowBillingOffset') === 'on',
					updatedAt: Math.floor(Date.now() / 1000)
				}
			});
		return { success: true };
	}
};
