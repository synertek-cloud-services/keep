import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { Db } from './db';
import * as schema from './db/schema';

export function utcDayStart(timestamp: number): number {
	const date = new Date(timestamp * 1000);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000;
}

export async function resolveDefaultContract(
	db: Db,
	companyId: string,
	at = Math.floor(Date.now() / 1000)
): Promise<string | null> {
	const day = utcDayStart(at);
	const contract = await db
		.select({ id: schema.contracts.id })
		.from(schema.contracts)
		.where(
			and(
				eq(schema.contracts.companyId, companyId),
				eq(schema.contracts.isDefault, true),
				eq(schema.contracts.status, 'active'),
				lte(schema.contracts.startDate, day),
				or(isNull(schema.contracts.endDate), gte(schema.contracts.endDate, day))
			)
		)
		.get();
	return contract?.id ?? null;
}

export async function validateEligibleContract(
	db: Db,
	contractId: string,
	companyId: string,
	at = Math.floor(Date.now() / 1000)
) {
	const day = utcDayStart(at);
	return (
		(await db
			.select()
			.from(schema.contracts)
			.where(
				and(
					eq(schema.contracts.id, contractId),
					eq(schema.contracts.companyId, companyId),
					eq(schema.contracts.status, 'active'),
					lte(schema.contracts.startDate, day),
					or(isNull(schema.contracts.endDate), gte(schema.contracts.endDate, day))
				)
			)
			.get()) ?? null
	);
}
