import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb(platform: App.Platform) {
	return drizzle(platform.env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
