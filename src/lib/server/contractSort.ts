import { asc, desc, type AnyColumn, type SQL } from 'drizzle-orm';
import * as schema from './db/schema';

export type ContractSortKey = 'name' | 'company' | 'status' | 'type' | 'startDate' | 'endDate';

const SORT_KEYS = new Set<string>(['name', 'company', 'status', 'type', 'startDate', 'endDate']);

export function isContractSortKey(value: string | null): value is ContractSortKey {
	return !!value && SORT_KEYS.has(value);
}

const SORT_EXPRESSIONS: Record<ContractSortKey, AnyColumn> = {
	name: schema.contracts.name,
	company: schema.companies.name,
	status: schema.contracts.status,
	type: schema.contracts.type,
	startDate: schema.contracts.startDate,
	endDate: schema.contracts.endDate
};

export function resolveContractOrderBy(sort: ContractSortKey, dir: 'asc' | 'desc'): [SQL, SQL] {
	const expression = SORT_EXPRESSIONS[sort];
	return [dir === 'asc' ? asc(expression) : desc(expression), asc(schema.contracts.id)];
}
