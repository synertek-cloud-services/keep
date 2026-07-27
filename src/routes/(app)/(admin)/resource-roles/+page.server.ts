import { asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ platform }) => ({
	resourceRoles: await getDb(platform!).select().from(schema.resourceRoles).orderBy(asc(schema.resourceRoles.name)).all()
});
