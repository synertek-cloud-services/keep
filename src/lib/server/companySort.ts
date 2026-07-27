import { asc, desc, type AnyColumn, type SQL } from 'drizzle-orm';
import * as schema from './db/schema';

export type CompanySortKey = 'name' | 'type' | 'slaPolicy' | 'status';

const SORT_KEYS = new Set<string>(['name', 'type', 'slaPolicy', 'status']);

export function isCompanySortKey(key: string | null): key is CompanySortKey {
	return !!key && SORT_KEYS.has(key);
}

const SORT_EXPRESSIONS: Record<CompanySortKey, AnyColumn> = {
	name: schema.companies.name,
	type: schema.companies.type,
	slaPolicy: schema.slaPolicies.name,
	status: schema.companies.status
};

export function resolveCompanyOrderBy(sort: CompanySortKey, dir: 'asc' | 'desc'): [SQL, SQL, SQL] {
	const primary = dir === 'asc' ? asc(SORT_EXPRESSIONS[sort]) : desc(SORT_EXPRESSIONS[sort]);
	return [primary, asc(schema.companies.name), asc(schema.companies.id)];
}
