import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!);
	const policies = await db.select().from(schema.slaPolicies).orderBy(schema.slaPolicies.name).all();
	return { policies };
};
