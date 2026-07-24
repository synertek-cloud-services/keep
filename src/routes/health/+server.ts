import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Outside (app)/(admin) route groups deliberately — no session required, so
// the release workflow's post-deploy check doesn't need credentials.
export const GET: RequestHandler = async () => {
	return json({ ok: true });
};
