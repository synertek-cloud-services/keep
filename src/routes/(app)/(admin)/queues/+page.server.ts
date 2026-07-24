import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!);
	const queues = await db.select().from(schema.queues).orderBy(schema.queues.name).all();
	return { queues };
};

export const actions: Actions = {
	create: async ({ request, platform }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Queue name is required.' });

		const db = getDb(platform!);
		const now = Math.floor(Date.now() / 1000);
		await db.insert(schema.queues).values({ id: crypto.randomUUID(), name, createdAt: now, updatedAt: now });
		return { success: true };
	},

	rename: async ({ request, platform }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Queue name is required.' });

		const db = getDb(platform!);
		await db.update(schema.queues).set({ name, updatedAt: Math.floor(Date.now() / 1000) }).where(eq(schema.queues.id, id));
		return { success: true };
	},

	remove: async ({ request, platform }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');

		// The seeded default queue is the hardcoded fallback in
		// lib/server/routing.ts's resolveQueueForIssueType — deleting it would
		// break ticket creation for anything with no matching Routing Rule.
		if (id === 'queue-general') {
			return fail(409, { error: 'The default "General" queue cannot be deleted — it is the fallback for unrouted tickets.' });
		}

		const db = getDb(platform!);

		const inUse = await db.select({ id: schema.tickets.id }).from(schema.tickets).where(eq(schema.tickets.queueId, id)).get();
		if (inUse) return fail(409, { error: 'Cannot delete a queue that has tickets in it.' });

		const usedByRule = await db.select({ id: schema.routingRules.id }).from(schema.routingRules).where(eq(schema.routingRules.targetQueueId, id)).get();
		if (usedByRule) return fail(409, { error: 'Cannot delete a queue used by a Routing Rule — remove the rule first.' });

		await db.delete(schema.queues).where(eq(schema.queues.id, id));
		return { success: true };
	}
};
