import { desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!);
	const users = await db.select().from(schema.users).orderBy(desc(schema.users.createdAt)).all();
	return { users };
};
