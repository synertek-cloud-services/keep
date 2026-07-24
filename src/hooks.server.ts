import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { getDb } from '$lib/server/db';
import { resolveSession, SESSION_COOKIE } from '$lib/server/auth/session';

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	const db = getDb(event.platform!);
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = token ? await resolveSession(db, token) : null;

	return resolve(event);
};
