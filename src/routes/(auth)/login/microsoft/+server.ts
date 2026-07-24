import { redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { generateToken, bytesToBase64 } from '$lib/server/auth/crypto';

const STATE_TTL_SECONDS = 10 * 60;

function toBase64Url(base64: string): string {
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkceChallenge(verifier: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return toBase64Url(bytesToBase64(new Uint8Array(digest)));
}

function callbackUrl(reqUrl: string): string {
	return `${new URL(reqUrl).origin}/login/microsoft/callback`;
}

// GET /login/microsoft — redirect to Microsoft's authorize endpoint
export const GET: RequestHandler = async ({ url, platform }) => {
	const db = getDb(platform!);
	const provider = await db
		.select()
		.from(schema.ssoProviders)
		.where(and(eq(schema.ssoProviders.type, 'microsoft'), eq(schema.ssoProviders.enabled, true)))
		.get();
	if (!provider) redirect(302, '/login?error=sso_not_configured');

	const codeVerifier = generateToken();
	const state = generateToken();
	const now = Math.floor(Date.now() / 1000);

	await db.insert(schema.ssoLoginState).values({
		id: state,
		ssoProviderId: provider.id,
		codeVerifier,
		// Unlike Beacon (which redirects back to a separate SPA origin), Keep is
		// single-origin — this is only kept as a column for schema parity /
		// future flexibility, always this app's own origin here.
		redirectUri: url.origin,
		createdAt: now,
		expiresAt: now + STATE_TTL_SECONDS
	});

	const authorizeUrl = new URL(
		`https://login.microsoftonline.com/${provider.directoryId}/oauth2/v2.0/authorize`
	);
	authorizeUrl.searchParams.set('client_id', provider.clientId);
	authorizeUrl.searchParams.set('response_type', 'code');
	authorizeUrl.searchParams.set('redirect_uri', callbackUrl(url.href));
	authorizeUrl.searchParams.set('response_mode', 'query');
	// GroupMember.Read.All is required for the callback's Graph memberOf
	// lookup — requires admin consent in the Entra app registration.
	authorizeUrl.searchParams.set('scope', 'openid profile email GroupMember.Read.All');
	authorizeUrl.searchParams.set('state', state);
	authorizeUrl.searchParams.set('code_challenge', await pkceChallenge(codeVerifier));
	authorizeUrl.searchParams.set('code_challenge_method', 'S256');

	redirect(302, authorizeUrl.toString());
};
