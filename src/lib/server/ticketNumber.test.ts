import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { applyMigrationsForTest } from './db/testMigrate';
import * as schema from './db/schema';
import { claimTicketNumber } from './ticketNumber';

const db = drizzle(env.DB, { schema });

beforeAll(async () => {
	await applyMigrationsForTest(env.DB);
});

describe('claimTicketNumber', () => {
	it('starts a fresh year at 1 and formats T-<year>-<padded 6 digits>', async () => {
		const number = await claimTicketNumber(db, Date.UTC(2030, 0, 1) / 1000);
		expect(number).toBe('T-2030-000001');
	});

	it('increments sequentially within the same year', async () => {
		const now = Date.UTC(2031, 5, 15) / 1000;
		const a = await claimTicketNumber(db, now);
		const b = await claimTicketNumber(db, now);
		const c = await claimTicketNumber(db, now);
		expect(a).toBe('T-2031-000001');
		expect(b).toBe('T-2031-000002');
		expect(c).toBe('T-2031-000003');
	});

	it('starts a new counter for a different year independent of other years', async () => {
		const y2032 = await claimTicketNumber(db, Date.UTC(2032, 0, 1) / 1000);
		expect(y2032).toBe('T-2032-000001');
	});

	// The regression this guards against: claiming via a separate SELECT then
	// UPDATE (instead of the single atomic UPSERT+RETURNING) would let
	// concurrent claims read the same stale value and produce duplicate
	// numbers. Firing N claims concurrently and asserting N distinct,
	// gapless numbers is the direct test of that invariant.
	it('produces distinct, gapless numbers under concurrent claims', async () => {
		const now = Date.UTC(2033, 2, 3) / 1000;
		const results = await Promise.all(Array.from({ length: 20 }, () => claimTicketNumber(db, now)));

		const numbers = results.map((r) => parseInt(r.split('-')[2], 10)).sort((a, b) => a - b);
		const unique = new Set(numbers);
		expect(unique.size).toBe(20);
		expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
	});
});
