import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { parseCurrencyToCents } from '$lib/contracts';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (params.id === 'new') return { isNew: true, resourceRole: null };
	const resourceRole = await getDb(platform!).select().from(schema.resourceRoles).where(eq(schema.resourceRoles.id, params.id)).get();
	if (!resourceRole) error(404, { message: 'Resource Role not found' });
	return { isNew: false, resourceRole };
};

export const actions: Actions = {
	save: async ({ request, params, platform }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const hourlyRateCents = parseCurrencyToCents(String(form.get('hourlyRate') ?? ''));
		if (!name || hourlyRateCents == null) return fail(400, { error: 'Name and a valid hourly rate are required.' });
		const db = getDb(platform!);
		const now = Math.floor(Date.now() / 1000);
		const id = params.id === 'new' ? crypto.randomUUID() : params.id;
		const existing = params.id === 'new' ? null : await db.select().from(schema.resourceRoles).where(eq(schema.resourceRoles.id, id)).get();
		const isDefault = form.get('isDefault') === 'on' || Boolean(existing?.isDefault);
		const isActive = form.get('isActive') === 'on';
		if (isDefault && !isActive) return fail(400, { error: 'The default Resource Role must remain active.' });
		if (isDefault) await db.update(schema.resourceRoles).set({ isDefault: false });
		const values = { name, description: String(form.get('description') ?? '').trim() || null, hourlyRateCents, isDefault, isActive, updatedAt: now };
		if (params.id === 'new') await db.insert(schema.resourceRoles).values({ id, ...values, createdAt: now });
		else await db.update(schema.resourceRoles).set(values).where(eq(schema.resourceRoles.id, id));
		redirect(303, '/resource-roles');
	}
};
