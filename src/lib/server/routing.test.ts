import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { applyMigrationsForTest } from './db/testMigrate';
import * as schema from './db/schema';
import { resolveQueueForIssueType } from './routing';

const db = drizzle(env.DB, { schema });

beforeAll(async () => {
	await applyMigrationsForTest(env.DB);

	const now = Math.floor(Date.now() / 1000);
	await db.insert(schema.queues).values([
		{ id: 'q-catchall', name: 'Catch-All Queue', createdAt: now, updatedAt: now },
		{ id: 'q-specific', name: 'Specific Queue', createdAt: now, updatedAt: now }
	]);
	// issue-computer / sub-computer-hardware come from the baseline seed.
	await db.insert(schema.routingRules).values([
		{ id: 'r-catchall', issueTypeId: 'issue-computer', subIssueTypeId: null, targetQueueId: 'q-catchall', createdAt: now, updatedAt: now },
		{ id: 'r-specific', issueTypeId: 'issue-computer', subIssueTypeId: 'sub-computer-hardware', targetQueueId: 'q-specific', createdAt: now, updatedAt: now }
	]);
});

describe('resolveQueueForIssueType', () => {
	it('prefers an exact issueType+subIssueType match over the catch-all', async () => {
		const queueId = await resolveQueueForIssueType(db, 'issue-computer', 'sub-computer-hardware');
		expect(queueId).toBe('q-specific');
	});

	it('falls back to the issue-type-level catch-all when no sub-type is given', async () => {
		const queueId = await resolveQueueForIssueType(db, 'issue-computer', null);
		expect(queueId).toBe('q-catchall');
	});

	it('falls back to the catch-all when the sub-type has no specific rule', async () => {
		const queueId = await resolveQueueForIssueType(db, 'issue-computer', 'sub-computer-software');
		expect(queueId).toBe('q-catchall');
	});

	it('falls back to the fallback queue when the issue type has no rules at all', async () => {
		const queueId = await resolveQueueForIssueType(db, 'issue-network', null, 'queue-general');
		expect(queueId).toBe('queue-general');
	});

	it('falls back to the fallback queue when issueTypeId is null', async () => {
		const queueId = await resolveQueueForIssueType(db, null, null, 'queue-general');
		expect(queueId).toBe('queue-general');
	});
});
