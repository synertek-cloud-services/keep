import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

export const load: PageServerLoad = async ({ params, platform }) => {
	if (params.id === 'new') {
		return {
			isNew: true,
			policy: null,
			priorities: PRIORITIES.map((priority) => ({ priority, responseMinutes: 0, resolutionMinutes: 0 }))
		};
	}

	const db = getDb(platform!);
	const policy = await db.select().from(schema.slaPolicies).where(eq(schema.slaPolicies.id, params.id)).get();
	if (!policy) error(404, { message: 'SLA policy not found' });

	const rows = await db
		.select()
		.from(schema.slaPolicyPriorities)
		.where(eq(schema.slaPolicyPriorities.policyId, params.id))
		.all();
	const priorities = PRIORITIES.map(
		(priority) => rows.find((r) => r.priority === priority) ?? { priority, responseMinutes: 0, resolutionMinutes: 0 }
	);

	return { isNew: false, policy, priorities };
};

export const actions: Actions = {
	save: async ({ request, params, platform }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const triageMinutes = Number(form.get('triageMinutes') ?? 0);

		if (!name || !Number.isFinite(triageMinutes) || triageMinutes < 0) {
			return fail(400, { error: 'A name and non-negative triage time are required.' });
		}

		const priorityRows = PRIORITIES.map((priority) => ({
			priority,
			responseMinutes: Number(form.get(`response_${priority}`) ?? 0),
			resolutionMinutes: Number(form.get(`resolution_${priority}`) ?? 0)
		}));
		for (const row of priorityRows) {
			if (!Number.isFinite(row.responseMinutes) || !Number.isFinite(row.resolutionMinutes) || row.responseMinutes < 0 || row.resolutionMinutes < 0) {
				return fail(400, { error: `Invalid response/resolution time for ${row.priority}.` });
			}
		}

		const db = getDb(platform!);
		const now = Math.floor(Date.now() / 1000);
		const isNew = params.id === 'new';
		const policyId = isNew ? crypto.randomUUID() : params.id;

		if (isNew) {
			await db.insert(schema.slaPolicies).values({ id: policyId, name, triageMinutes, createdAt: now, updatedAt: now });
		} else {
			await db.update(schema.slaPolicies).set({ name, triageMinutes, updatedAt: now }).where(eq(schema.slaPolicies.id, policyId));
		}

		// Fixed 4-row set (always exactly critical/high/medium/low) — batch
		// delete+insert is simpler and just as correct as a conditional
		// insert-vs-update per row, since the set of priorities never changes.
		await db.delete(schema.slaPolicyPriorities).where(eq(schema.slaPolicyPriorities.policyId, policyId));
		await db.insert(schema.slaPolicyPriorities).values(priorityRows.map((r) => ({ policyId, ...r })));

		redirect(303, `/sla-policies/${policyId}`);
	}
};
