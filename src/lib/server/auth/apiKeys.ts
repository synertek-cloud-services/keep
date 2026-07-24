import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../db';
import * as schema from '../db/schema';
import { generateToken, sha256hex } from './crypto';

// Same shape as session tokens: opaque random token, only the SHA-256 hash
// ever persisted. The raw value is shown to the admin exactly once at
// creation time and is never retrievable again — revoke-and-reissue only,
// same UX as Beacon's enrollment-token rotation.
export async function generateApiKey(): Promise<{ raw: string; hash: string }> {
	const raw = `keep_${generateToken()}`;
	const hash = await sha256hex(raw);
	return { raw, hash };
}

export interface VerifiedApiKey {
	id: string;
	name: string;
	defaultIssueTypeId: string | null;
	defaultSubIssueTypeId: string | null;
}

export async function verifyApiKey(db: Db, rawKey: string | undefined | null): Promise<VerifiedApiKey | null> {
	if (!rawKey) return null;

	const hash = await sha256hex(rawKey);
	const row = await db
		.select()
		.from(schema.apiKeys)
		.where(and(eq(schema.apiKeys.keyHash, hash), isNull(schema.apiKeys.revokedAt)))
		.get();

	if (!row) return null;

	await db
		.update(schema.apiKeys)
		.set({ lastUsedAt: Math.floor(Date.now() / 1000) })
		.where(eq(schema.apiKeys.id, row.id));

	return {
		id: row.id,
		name: row.name,
		defaultIssueTypeId: row.defaultIssueTypeId,
		defaultSubIssueTypeId: row.defaultSubIssueTypeId
	};
}
