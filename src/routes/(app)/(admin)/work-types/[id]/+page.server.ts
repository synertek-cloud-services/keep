import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { BILLING_ROUNDING_INCREMENTS } from '$lib/timeEntryBilling';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (params.id === 'new') return { isNew: true, workType: null };
	const workType = await getDb(platform!).select().from(schema.workTypes).where(eq(schema.workTypes.id, params.id)).get();
	if (!workType) error(404, { message: 'Work Type not found' });
	return { isNew: false, workType };
};

export const actions: Actions = {
	save: async ({ request, params, platform }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const minimumBillableMinutes = Number(form.get('minimumBillableMinutes') ?? 0);
		const roundingRaw = String(form.get('roundingMinutes') ?? '');
		const roundingMinutes = roundingRaw === '' ? null : Number(roundingRaw);
		if (!name || !Number.isInteger(minimumBillableMinutes) || minimumBillableMinutes < 0)
			return fail(400, { error: 'Name and a valid minimum are required.' });
		if (roundingMinutes != null && !BILLING_ROUNDING_INCREMENTS.includes(roundingMinutes as never))
			return fail(400, { error: 'Choose a supported rounding increment.' });
		const db = getDb(platform!);
		const now = Math.floor(Date.now() / 1000);
		const id = params.id === 'new' ? crypto.randomUUID() : params.id;
		const existing = params.id === 'new' ? null : await db.select().from(schema.workTypes).where(eq(schema.workTypes.id, id)).get();
		const isDefault = form.get('isDefault') === 'on' || Boolean(existing?.isDefault);
		const isActive = form.get('isActive') === 'on';
		if (isDefault && !isActive) return fail(400, { error: 'The default Work Type must remain active.' });
		if (isDefault) await db.update(schema.workTypes).set({ isDefault: false });
		const values = {
			name,
			code: String(form.get('code') ?? '').trim() || null,
			description: String(form.get('description') ?? '').trim() || null,
			isActive,
			isDefault,
			billableByDefault: form.get('billableByDefault') === 'on',
			minimumBillableMinutes,
			roundingMinutes,
			updatedAt: now
		};
		if (params.id === 'new') await db.insert(schema.workTypes).values({ id, ...values, createdAt: now });
		else await db.update(schema.workTypes).set(values).where(eq(schema.workTypes.id, id));
		redirect(303, '/work-types');
	}
};
