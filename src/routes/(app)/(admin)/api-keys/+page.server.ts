import { fail } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { generateApiKey } from '$lib/server/auth/apiKeys';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!);

	const keys = await db
		.select({
			id: schema.apiKeys.id,
			name: schema.apiKeys.name,
			createdAt: schema.apiKeys.createdAt,
			lastUsedAt: schema.apiKeys.lastUsedAt,
			revokedAt: schema.apiKeys.revokedAt,
			defaultIssueTypeName: schema.issueTypes.name,
			defaultSubIssueTypeName: schema.subIssueTypes.name
		})
		.from(schema.apiKeys)
		.leftJoin(schema.issueTypes, eq(schema.issueTypes.id, schema.apiKeys.defaultIssueTypeId))
		.leftJoin(schema.subIssueTypes, eq(schema.subIssueTypes.id, schema.apiKeys.defaultSubIssueTypeId))
		.orderBy(desc(schema.apiKeys.createdAt))
		.all();

	const issueTypes = await db.select().from(schema.issueTypes).orderBy(schema.issueTypes.sortOrder).all();
	const subIssueTypes = await db.select().from(schema.subIssueTypes).orderBy(schema.subIssueTypes.sortOrder).all();

	return { keys, issueTypes, subIssueTypes };
};

export const actions: Actions = {
	create: async ({ request, locals, platform }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const defaultIssueTypeId = String(form.get('defaultIssueTypeId') ?? '') || null;
		const defaultSubIssueTypeId = String(form.get('defaultSubIssueTypeId') ?? '') || null;

		if (!name) return fail(400, { error: 'A name is required.' });

		const db = getDb(platform!);
		const { raw, hash } = await generateApiKey();
		await db.insert(schema.apiKeys).values({
			id: crypto.randomUUID(),
			name,
			keyHash: hash,
			defaultIssueTypeId,
			defaultSubIssueTypeId,
			createdAt: Math.floor(Date.now() / 1000),
			createdBy: locals.user!.id
		});

		// The only time the raw key is ever available — shown once in the UI,
		// never retrievable again since only the hash is persisted.
		return { success: true, rawKey: raw, keyName: name };
	},

	revoke: async ({ request, platform }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const db = getDb(platform!);
		await db.update(schema.apiKeys).set({ revokedAt: Math.floor(Date.now() / 1000) }).where(eq(schema.apiKeys.id, id));
		return { success: true };
	}
};
