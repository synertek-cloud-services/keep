import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!);

	const rules = await db
		.select({
			id: schema.routingRules.id,
			issueTypeId: schema.routingRules.issueTypeId,
			issueTypeName: schema.issueTypes.name,
			subIssueTypeId: schema.routingRules.subIssueTypeId,
			subIssueTypeName: schema.subIssueTypes.name,
			targetQueueId: schema.routingRules.targetQueueId,
			targetQueueName: schema.queues.name
		})
		.from(schema.routingRules)
		.innerJoin(schema.issueTypes, eq(schema.issueTypes.id, schema.routingRules.issueTypeId))
		.leftJoin(schema.subIssueTypes, eq(schema.subIssueTypes.id, schema.routingRules.subIssueTypeId))
		.innerJoin(schema.queues, eq(schema.queues.id, schema.routingRules.targetQueueId))
		.all();

	const issueTypes = await db.select().from(schema.issueTypes).orderBy(schema.issueTypes.sortOrder).all();
	const subIssueTypes = await db.select().from(schema.subIssueTypes).orderBy(schema.subIssueTypes.sortOrder).all();
	const queues = await db.select().from(schema.queues).orderBy(schema.queues.name).all();

	return { rules, issueTypes, subIssueTypes, queues };
};

export const actions: Actions = {
	create: async ({ request, platform }) => {
		const form = await request.formData();
		const issueTypeId = String(form.get('issueTypeId') ?? '');
		const subIssueTypeId = String(form.get('subIssueTypeId') ?? '') || null;
		const targetQueueId = String(form.get('targetQueueId') ?? '');

		if (!issueTypeId || !targetQueueId) {
			return fail(400, { error: 'An issue type and target queue are required.' });
		}

		const db = getDb(platform!);
		const now = Math.floor(Date.now() / 1000);
		await db.insert(schema.routingRules).values({
			id: crypto.randomUUID(),
			issueTypeId,
			subIssueTypeId,
			targetQueueId,
			createdAt: now,
			updatedAt: now
		});
		return { success: true };
	},

	remove: async ({ request, platform }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const db = getDb(platform!);
		await db.delete(schema.routingRules).where(eq(schema.routingRules.id, id));
		return { success: true };
	}
};
