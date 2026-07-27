import { error, fail, redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { hashPassword } from '$lib/server/auth/password';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getDb(platform!);
	const resourceRoles = await db.select().from(schema.resourceRoles).orderBy(asc(schema.resourceRoles.name)).all();
	if (params.id === 'new') {
		return { isNew: true, editUser: null, resourceRoles, assignedRoles: [] };
	}

	const editUser = await db.select().from(schema.users).where(eq(schema.users.id, params.id)).get();
	if (!editUser) error(404, { message: 'User not found' });
	const assignedRoles = await db.select().from(schema.userResourceRoles).where(eq(schema.userResourceRoles.userId, params.id)).all();
	return { isNew: false, editUser, resourceRoles, assignedRoles };
};

export const actions: Actions = {
	save: async ({ request, params, platform }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const displayName = String(form.get('displayName') ?? '').trim() || null;
		const role = String(form.get('role') ?? 'tech');
		const password = String(form.get('password') ?? '');
		const selectedRoleIds = form.getAll('resourceRoleIds').map(String);
		const defaultResourceRoleId = String(form.get('defaultResourceRoleId') ?? '');

		if (!email || (role !== 'admin' && role !== 'tech')) {
			return fail(400, { error: 'A valid email and role are required.' });
		}

		const db = getDb(platform!);
		const now = Math.floor(Date.now() / 1000);
		const isNew = params.id === 'new';
		const userId = isNew ? crypto.randomUUID() : params.id;
		const validRoles = await db.select().from(schema.resourceRoles).where(eq(schema.resourceRoles.isActive, true)).all();
		const validRoleIds = new Set(validRoles.map((item) => item.id));
		const assignments = selectedRoleIds.filter((id) => validRoleIds.has(id));
		const fallbackRole = validRoles.find((item) => item.isDefault);
		if (!assignments.length && fallbackRole) assignments.push(fallbackRole.id);
		const effectiveDefault = assignments.includes(defaultResourceRoleId) ? defaultResourceRoleId : assignments[0];

		if (isNew) {
			if (!password) return fail(400, { error: 'A password is required for a new user.' });
			await db.insert(schema.users).values({
				id: userId,
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
		await db.delete(schema.userResourceRoles).where(eq(schema.userResourceRoles.userId, userId));
		for (const resourceRoleId of assignments) {
			await db.insert(schema.userResourceRoles).values({
				userId,
				resourceRoleId,
				isDefault: resourceRoleId === effectiveDefault
			});
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
