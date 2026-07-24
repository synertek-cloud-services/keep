import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!);
	const companies = await db
		.select({
			id: schema.companies.id,
			name: schema.companies.name,
			type: schema.companies.type,
			status: schema.companies.status,
			slaPolicyName: schema.slaPolicies.name
		})
		.from(schema.companies)
		.leftJoin(schema.slaPolicies, eq(schema.slaPolicies.id, schema.companies.slaPolicyId))
		.orderBy(desc(schema.companies.createdAt))
		.all();
	return { companies };
};
