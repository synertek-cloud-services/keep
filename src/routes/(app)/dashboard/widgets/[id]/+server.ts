import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

// Small JSON endpoint (not a form action) specifically for drag/resize
// persistence — avoids a full action round-trip disrupting an in-progress
// drag interaction. Admin-only, same as the rest of dashboard editing.
export const PATCH: RequestHandler = async ({ request, params, locals, platform }) => {
	if (locals.user?.role !== 'admin') error(403, { message: 'Admins only' });

	const body = (await request.json()) as { gridX?: number; gridY?: number; gridW?: number; gridH?: number };
	const updates: Partial<typeof schema.dashboardWidgets.$inferInsert> = { updatedAt: Math.floor(Date.now() / 1000) };
	if (body.gridX !== undefined) updates.gridX = body.gridX;
	if (body.gridY !== undefined) updates.gridY = body.gridY;
	if (body.gridW !== undefined) updates.gridW = body.gridW;
	if (body.gridH !== undefined) updates.gridH = body.gridH;

	const db = getDb(platform!);
	await db.update(schema.dashboardWidgets).set(updates).where(eq(schema.dashboardWidgets.id, params.id));
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
	if (locals.user?.role !== 'admin') error(403, { message: 'Admins only' });

	const db = getDb(platform!);
	await db.delete(schema.dashboardWidgets).where(eq(schema.dashboardWidgets.id, params.id));
	return json({ success: true });
};
