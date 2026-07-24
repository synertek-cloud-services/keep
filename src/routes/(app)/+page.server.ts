import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { loadDashboardData } from '$lib/server/dashboardData';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!);

	// v1 has exactly one dashboard — the seeded default. No multi-dashboard
	// switching chrome needed.
	const dashboard = await db.select().from(schema.dashboards).where(eq(schema.dashboards.isDefault, true)).get();
	const widgets = dashboard
		? await db
				.select()
				.from(schema.dashboardWidgets)
				.where(eq(schema.dashboardWidgets.dashboardId, dashboard.id))
				.orderBy(schema.dashboardWidgets.sortOrder)
				.all()
		: [];

	const data = await loadDashboardData(db);

	return { dashboard, widgets, data };
};
