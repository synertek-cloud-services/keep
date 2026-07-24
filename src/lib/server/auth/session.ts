import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import * as schema from '../db/schema';
import { sha256hex, generateToken } from './crypto';

// 2-tier (admin | tech) — Keep's Resource.role spec has no readonly/auditor
// use case, unlike Beacon's 3-tier admin/technician/readonly.
export type Role = 'admin' | 'tech';

const ROLE_RANK: Record<Role, number> = { tech: 0, admin: 1 };

export function roleAtLeast(role: Role, min: Role): boolean {
	return ROLE_RANK[role] >= ROLE_RANK[min];
}

// Used when a user's SSO group memberships match more than one role mapping.
export function highestRole(roles: Role[]): Role | null {
	return roles.reduce<Role | null>(
		(best, r) => (!best || ROLE_RANK[r] > ROLE_RANK[best] ? r : best),
		null
	);
}

export interface AuthedUser {
	id: string;
	email: string;
	displayName: string | null;
	role: Role;
}

export const SESSION_COOKIE = 'keep_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Only bump last_used_at if it's gone stale — avoids a D1 write on every
// single authenticated request. Same throttling Beacon uses.
const LAST_USED_THROTTLE_SECONDS = 5 * 60;

export async function createSession(
	db: Db,
	userId: string,
	opts?: { userAgent?: string | null; ip?: string | null }
): Promise<{ token: string; expiresAt: number }> {
	const token = generateToken();
	const tokenHash = await sha256hex(token);
	const now = Math.floor(Date.now() / 1000);
	const expiresAt = now + SESSION_TTL_SECONDS;

	await db.insert(schema.userSessions).values({
		id: crypto.randomUUID(),
		userId,
		tokenHash,
		createdAt: now,
		expiresAt,
		userAgent: opts?.userAgent ?? null,
		ip: opts?.ip ?? null
	});

	return { token, expiresAt };
}

// Resolves a raw session-cookie token to the authenticated user. Mirrors
// Beacon's requireUser internals minus the RBAC-gate part — role gating
// happens in route-group +layout.server.ts files, not here.
export async function resolveSession(db: Db, token: string | undefined | null): Promise<AuthedUser | null> {
	if (!token) return null;

	const tokenHash = await sha256hex(token);
	const now = Math.floor(Date.now() / 1000);

	const row = await db
		.select({
			sessionId: schema.userSessions.id,
			expiresAt: schema.userSessions.expiresAt,
			revokedAt: schema.userSessions.revokedAt,
			lastUsedAt: schema.userSessions.lastUsedAt,
			userId: schema.users.id,
			email: schema.users.email,
			displayName: schema.users.displayName,
			role: schema.users.role,
			isActive: schema.users.isActive
		})
		.from(schema.userSessions)
		.innerJoin(schema.users, eq(schema.users.id, schema.userSessions.userId))
		.where(eq(schema.userSessions.tokenHash, tokenHash))
		.get();

	if (!row || row.revokedAt || row.expiresAt < now || !row.isActive) return null;

	if (!row.lastUsedAt || now - row.lastUsedAt > LAST_USED_THROTTLE_SECONDS) {
		await db
			.update(schema.userSessions)
			.set({ lastUsedAt: now })
			.where(eq(schema.userSessions.id, row.sessionId));
	}

	return { id: row.userId, email: row.email, displayName: row.displayName, role: row.role as Role };
}

export async function revokeSession(db: Db, token: string): Promise<void> {
	const tokenHash = await sha256hex(token);
	await db
		.update(schema.userSessions)
		.set({ revokedAt: Math.floor(Date.now() / 1000) })
		.where(eq(schema.userSessions.tokenHash, tokenHash));
}
