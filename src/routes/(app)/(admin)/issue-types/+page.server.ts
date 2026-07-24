import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!);
	const issueTypes = await db.select().from(schema.issueTypes).orderBy(schema.issueTypes.sortOrder).all();
	const subIssueTypes = await db.select().from(schema.subIssueTypes).orderBy(schema.subIssueTypes.sortOrder).all();
	return { issueTypes, subIssueTypes };
};

export const actions: Actions = {
	createIssueType: async ({ request, platform }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Issue type name is required.' });

		const db = getDb(platform!);
		const maxSort = await db.select({ id: schema.issueTypes.id }).from(schema.issueTypes).all();
		await db.insert(schema.issueTypes).values({
			id: crypto.randomUUID(),
			name,
			sortOrder: maxSort.length,
			createdAt: Math.floor(Date.now() / 1000)
		});
		return { success: true };
	},

	renameIssueType: async ({ request, platform }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Issue type name is required.' });
		const db = getDb(platform!);
		await db.update(schema.issueTypes).set({ name }).where(eq(schema.issueTypes.id, id));
		return { success: true };
	},

	deleteIssueType: async ({ request, platform }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const db = getDb(platform!);

		const inUse = await db.select({ id: schema.tickets.id }).from(schema.tickets).where(eq(schema.tickets.issueTypeId, id)).get();
		if (inUse) return fail(409, { error: 'Cannot delete an issue type that is in use by tickets.' });

		await db.delete(schema.issueTypes).where(eq(schema.issueTypes.id, id)); // sub-types cascade
		return { success: true };
	},

	createSubType: async ({ request, platform }) => {
		const form = await request.formData();
		const issueTypeId = String(form.get('issueTypeId') ?? '');
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Sub-issue type name is required.' });

		const db = getDb(platform!);
		const siblings = await db.select({ id: schema.subIssueTypes.id }).from(schema.subIssueTypes).where(eq(schema.subIssueTypes.issueTypeId, issueTypeId)).all();
		await db.insert(schema.subIssueTypes).values({
			id: crypto.randomUUID(),
			issueTypeId,
			name,
			sortOrder: siblings.length,
			createdAt: Math.floor(Date.now() / 1000)
		});
		return { success: true };
	},

	renameSubType: async ({ request, platform }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Sub-issue type name is required.' });
		const db = getDb(platform!);
		await db.update(schema.subIssueTypes).set({ name }).where(eq(schema.subIssueTypes.id, id));
		return { success: true };
	},

	deleteSubType: async ({ request, platform }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const db = getDb(platform!);

		const inUse = await db.select({ id: schema.tickets.id }).from(schema.tickets).where(eq(schema.tickets.subIssueTypeId, id)).get();
		if (inUse) return fail(409, { error: 'Cannot delete a sub-issue type that is in use by tickets.' });

		await db.delete(schema.subIssueTypes).where(eq(schema.subIssueTypes.id, id));
		return { success: true };
	}
};
