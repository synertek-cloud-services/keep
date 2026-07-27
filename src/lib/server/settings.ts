import { eq } from 'drizzle-orm';
import type { Db } from './db';
import * as schema from './db/schema';

export const ORGANIZATION_SETTINGS_ID = 'organization-default';
export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

export async function getOrganizationTimezone(db: Db): Promise<string> {
	const settings = await db
		.select({ timezone: schema.organizationSettings.timezone })
		.from(schema.organizationSettings)
		.where(eq(schema.organizationSettings.id, ORGANIZATION_SETTINGS_ID))
		.get();
	return settings?.timezone ?? DEFAULT_TIMEZONE;
}
