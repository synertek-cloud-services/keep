import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { applyMigrationsForTest } from './db/testMigrate';
import * as schema from './db/schema';

const db = drizzle(env.DB, { schema });

beforeAll(async () => {
	await applyMigrationsForTest(env.DB);
	const now = Math.floor(Date.now() / 1000);
	await db.insert(schema.companies).values({
		id: 'contract-test-company',
		name: 'Contract Test Company',
		type: 'client',
		status: 'active',
		slaPolicyId: 'sla-standard',
		defaultBillable: true,
		createdAt: now,
		updatedAt: now
	});
});

describe('contract default invariant', () => {
	it('allows at most one default contract per company', async () => {
		const now = Math.floor(Date.now() / 1000);
		const base = {
			companyId: 'contract-test-company',
			status: 'active' as const,
			type: 'recurring' as const,
			billingModel: 'included_hours' as const,
			startDate: Date.UTC(2026, 0, 1) / 1000,
			fixedFeeCents: 0,
			includedMinutes: 600,
			hourlyRateCents: 15_000,
			isDefault: true,
			createdAt: now,
			updatedAt: now
		};

		await db.insert(schema.contracts).values({ id: 'contract-default-a', name: 'Default A', ...base });
		await expect(
			db.insert(schema.contracts).values({ id: 'contract-default-b', name: 'Default B', ...base })
		).rejects.toThrow();

		await db
			.update(schema.contracts)
			.set({ isDefault: false })
			.where(eq(schema.contracts.id, 'contract-default-a'));
		await expect(
			db.insert(schema.contracts).values({ id: 'contract-default-b', name: 'Default B', ...base })
		).resolves.toBeDefined();
	});
});
