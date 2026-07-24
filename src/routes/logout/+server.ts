import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { revokeSession, SESSION_COOKIE } from '$lib/server/auth/session';

export const POST: RequestHandler = async ({ cookies, platform }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) {
		const db = getDb(platform!);
		await revokeSession(db, token);
	}
	cookies.delete(SESSION_COOKIE, { path: '/' });
	redirect(302, '/login');
};
