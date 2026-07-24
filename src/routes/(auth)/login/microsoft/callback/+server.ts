import { redirect } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { decryptSecret } from '$lib/server/auth/crypto';
import { verifyMicrosoftIdToken, fetchMemberGroups } from '$lib/server/auth/oidc';
import { createSession, highestRole, SESSION_COOKIE, SESSION_TTL_SECONDS, type Role } from '$lib/server/auth/session';
import { dev } from '$app/environment';

function callbackUrl(reqUrl: string): string {
	return `${new URL(reqUrl).origin}/login/microsoft/callback`;
}

// GET /login/microsoft/callback — code exchange, id_token verify,
// group->role resolution, session creation. Unlike Beacon's version of this
// route (which redirects to a separate SPA origin carrying a one-time
// exchange code, since the real session token can never appear in a
// cross-origin redirect URL), Keep is single-origin with a cookie-based
// session: this route sets the httpOnly cookie itself and redirects straight
// to `/` — no exchange step needed.
export const GET: RequestHandler = async ({ url, cookies, platform, request }) => {
	const db = getDb(platform!);
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!code || !state) redirect(302, '/login?error=missing_code_or_state');

	const stateRow = await db
		.select()
		.from(schema.ssoLoginState)
		.where(eq(schema.ssoLoginState.id, state))
		.get();
	if (stateRow) {
		await db.delete(schema.ssoLoginState).where(eq(schema.ssoLoginState.id, state)); // single-use
	}
	const now = Math.floor(Date.now() / 1000);
	if (!stateRow || stateRow.expiresAt < now) redirect(302, '/login?error=expired_or_invalid_state');

	const provider = await db
		.select()
		.from(schema.ssoProviders)
		.where(eq(schema.ssoProviders.id, stateRow.ssoProviderId))
		.get();
	if (!provider || !provider.enabled) redirect(302, '/login?error=provider_not_found');

	const fail = (reason: string) => redirect(302, `/login?error=${encodeURIComponent(reason)}`);

	const clientSecret = await decryptSecret(
		provider.clientSecretCiphertext,
		provider.clientSecretNonce,
		platform!.env.CONFIG_ENCRYPTION_KEY
	);

	const tokenRes = await fetch(
		`https://login.microsoftonline.com/${provider.directoryId}/oauth2/v2.0/token`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: provider.clientId,
				client_secret: clientSecret,
				grant_type: 'authorization_code',
				code,
				redirect_uri: callbackUrl(url.href),
				code_verifier: stateRow.codeVerifier
			})
		}
	);
	if (!tokenRes.ok) return fail('token_exchange_failed');
	const tokenBody = (await tokenRes.json()) as { id_token: string; access_token: string };

	let claims;
	try {
		claims = await verifyMicrosoftIdToken(tokenBody.id_token, provider.directoryId, provider.clientId);
	} catch {
		return fail('id_token_verification_failed');
	}

	const groups = await fetchMemberGroups(tokenBody.access_token);
	const groupIds = groups.map((g) => g.id);

	const mappings = groupIds.length
		? await db
				.select()
				.from(schema.ssoGroupRoleMappings)
				.where(
					and(
						eq(schema.ssoGroupRoleMappings.ssoProviderId, provider.id),
						inArray(schema.ssoGroupRoleMappings.groupId, groupIds)
					)
				)
				.all()
		: [];
	const role = highestRole(mappings.map((m) => m.role as Role));
	if (!role) return fail('no_group_mapping');

	const email = claims.email ?? claims.preferred_username ?? `${claims.oid}@microsoft`;
	const displayName = claims.name ?? null;

	const existingByIdentity = await db
		.select()
		.from(schema.users)
		.where(and(eq(schema.users.ssoProviderId, provider.id), eq(schema.users.ssoSubject, claims.oid)))
		.get();

	if (existingByIdentity) {
		await db
			.update(schema.users)
			.set({ role, displayName, email, lastLoginAt: now, updatedAt: now })
			.where(eq(schema.users.id, existingByIdentity.id));
	} else {
		// Guard against an Entra-side actor claiming a pre-existing local admin
		// account by registering a matching email — reject rather than
		// silently merge identities.
		const existingByEmail = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();
		if (existingByEmail) return fail('email_already_registered_locally');

		await db.insert(schema.users).values({
			id: crypto.randomUUID(),
			email,
			displayName,
			role,
			isActive: true,
			authSource: 'microsoft',
			ssoProviderId: provider.id,
			ssoSubject: claims.oid,
			createdAt: now,
			updatedAt: now,
			lastLoginAt: now
		});
	}

	const user = await db
		.select()
		.from(schema.users)
		.where(and(eq(schema.users.ssoProviderId, provider.id), eq(schema.users.ssoSubject, claims.oid)))
		.get();
	if (!user || !user.isActive) return fail('account_disabled');

	const { token } = await createSession(db, user.id, {
		userAgent: request.headers.get('user-agent'),
		ip: request.headers.get('cf-connecting-ip')
	});

	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: SESSION_TTL_SECONDS
	});

	redirect(302, '/');
};
