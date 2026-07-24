import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { WIDGET_TYPES } from '$lib/server/dashboardData';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (locals.user?.role !== 'admin') error(403, { message: 'Admins only' });

	const body = (await request.json()) as { type?: string };
	const known = WIDGET_TYPES.find((w) => w.type === body.type);
	if (!known) error(400, { message: 'Unknown widget type' });

	const db = getDb(platform!);
	const dashboard = await db.select().from(schema.dashboards).where(eq(schema.dashboards.isDefault, true)).get();
	if (!dashboard) error(404, { message: 'No default dashboard' });

	const existing = await db
		.select({ n: schema.dashboardWidgets.sortOrder })
		.from(schema.dashboardWidgets)
		.where(eq(schema.dashboardWidgets.dashboardId, dashboard.id))
		.all();

	const now = Math.floor(Date.now() / 1000);
	const id = crypto.randomUUID();
	await db.insert(schema.dashboardWidgets).values({
		id,
		dashboardId: dashboard.id,
		type: known.type,
		title: known.title,
		config: '{}',
		gridX: 0,
		gridY: 0,
		gridW: known.shape === 'big_number' ? 3 : 4,
		gridH: known.shape === 'big_number' ? 2 : 5,
		sortOrder: existing.length,
		createdAt: now,
		updatedAt: now
	});

	return json({ id }, { status: 201 });
};
