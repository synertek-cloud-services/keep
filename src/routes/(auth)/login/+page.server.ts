import { fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { verifyPassword } from '$lib/server/auth/password';
import { createSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from '$lib/server/auth/session';
import { dev } from '$app/environment';

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (locals.user) redirect(302, '/');

	const db = getDb(platform!);
	// Deliberately exposes only whether a sign-in choice can be shown —
	// provider configuration remains private, and the callback route still
	// checks it authoritatively.
	const provider = await db
		.select({ id: schema.ssoProviders.id })
		.from(schema.ssoProviders)
		.where(and(eq(schema.ssoProviders.type, 'microsoft'), eq(schema.ssoProviders.enabled, true)))
		.get();

	return { microsoftAvailable: !!provider, ssoError: url.searchParams.get('error') };
};

export const actions: Actions = {
	default: async ({ request, cookies, platform, getClientAddress }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(form.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.', email });
		}

		const db = getDb(platform!);
		const user = await db
			.select()
			.from(schema.users)
			.where(eq(schema.users.email, email))
			.get();

		if (!user || !user.isActive || !user.passwordHash) {
			return fail(400, { error: 'Invalid email or password.', email });
		}

		const valid = await verifyPassword(password, user.passwordHash);
		if (!valid) {
			return fail(400, { error: 'Invalid email or password.', email });
		}

		const { token } = await createSession(db, user.id, {
			userAgent: request.headers.get('user-agent'),
			ip: getClientAddress()
		});

		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			secure: !dev,
			sameSite: 'lax',
			maxAge: SESSION_TTL_SECONDS
		});

		await db
			.update(schema.users)
			.set({ lastLoginAt: Math.floor(Date.now() / 1000) })
			.where(eq(schema.users.id, user.id));

		redirect(302, '/');
	}
};
