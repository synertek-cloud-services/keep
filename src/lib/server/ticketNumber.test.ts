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
	it('starts a fresh day at 1 and formats T-<YYYYMMDD>-<padded 4 digits>', async () => {
		const number = await claimTicketNumber(db, Date.UTC(2030, 0, 1) / 1000);
		expect(number).toBe('T-20300101-0001');
	});

	it('increments sequentially within the same day', async () => {
		const now = Date.UTC(2031, 5, 15) / 1000;
		const a = await claimTicketNumber(db, now);
		const b = await claimTicketNumber(db, now);
		const c = await claimTicketNumber(db, now);
		expect(a).toBe('T-20310615-0001');
		expect(b).toBe('T-20310615-0002');
		expect(c).toBe('T-20310615-0003');
	});

	it('starts a new counter for a different day independent of other days', async () => {
		const day1 = await claimTicketNumber(db, Date.UTC(2032, 0, 1) / 1000);
		expect(day1).toBe('T-20320101-0001');
		const day2 = await claimTicketNumber(db, Date.UTC(2032, 0, 2) / 1000);
		expect(day2).toBe('T-20320102-0001');
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
