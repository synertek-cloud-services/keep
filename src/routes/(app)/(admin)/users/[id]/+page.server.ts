import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { hashPassword } from '$lib/server/auth/password';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (params.id === 'new') {
		return { isNew: true, editUser: null };
	}

	const db = getDb(platform!);
	const editUser = await db.select().from(schema.users).where(eq(schema.users.id, params.id)).get();
	if (!editUser) error(404, { message: 'User not found' });

	return { isNew: false, editUser };
};

export const actions: Actions = {
	save: async ({ request, params, platform }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const displayName = String(form.get('displayName') ?? '').trim() || null;
		const role = String(form.get('role') ?? 'tech');
		const password = String(form.get('password') ?? '');

		if (!email || (role !== 'admin' && role !== 'tech')) {
			return fail(400, { error: 'A valid email and role are required.' });
		}

		const db = getDb(platform!);
		const now = Math.floor(Date.now() / 1000);
		const isNew = params.id === 'new';

		if (isNew) {
			if (!password) return fail(400, { error: 'A password is required for a new user.' });
			await db.insert(schema.users).values({
				id: crypto.randomUUID(),
				email,
				displayName,
				role: role as 'admin' | 'tech',
				isActive: true,
				passwordHash: await hashPassword(password),
				authSource: 'local',
				createdAt: now,
				updatedAt: now
			});
		} else {
			const updates: Partial<typeof schema.users.$inferInsert> = {
				email,
				displayName,
				role: role as 'admin' | 'tech',
				updatedAt: now
			};
			if (password) updates.passwordHash = await hashPassword(password);
			await db.update(schema.users).set(updates).where(eq(schema.users.id, params.id));
		}

		redirect(303, '/users');
	},

	setActive: async ({ request, params, platform }) => {
		const form = await request.formData();
		const isActive = form.get('isActive') === '1';
		const db = getDb(platform!);
		await db
			.update(schema.users)
			.set({ isActive, updatedAt: Math.floor(Date.now() / 1000) })
			.where(eq(schema.users.id, params.id));
		return { success: true };
	}
};
