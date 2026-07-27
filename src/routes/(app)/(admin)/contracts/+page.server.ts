import { and, eq, like, or, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { getListPageSize } from '$lib/listPreferences';
import { isPageSize, resolvePageSize } from '$lib/ticketPageSize';
import { isContractStatus, isContractType } from '$lib/contracts';
import { isContractSortKey, resolveContractOrderBy } from '$lib/server/contractSort';
import { updateListPageSize } from '$lib/server/users';

const LIST_KEY = 'contracts';

export const load: PageServerLoad = async ({ url, locals, platform }) => {
	const db = getDb(platform!);
	const currentUser = await db
		.select({ listPreferences: schema.users.listPreferences })
		.from(schema.users)
		.where(eq(schema.users.id, locals.user!.id))
		.get();
	const pageSize = resolvePageSize(
		url.searchParams.get('pageSize'),
		getListPageSize(currentUser?.listPreferences, LIST_KEY)
	);

	const q = url.searchParams.get('q')?.trim().slice(0, 100) ?? '';
	const statusParam = url.searchParams.get('status');
	const status = statusParam && isContractStatus(statusParam) ? statusParam : 'all';
	const typeParam = url.searchParams.get('type');
	const type = typeParam && isContractType(typeParam) ? typeParam : 'all';
	const sortParam = url.searchParams.get('sort');
	const sort = isContractSortKey(sortParam) ? sortParam : 'name';
	const dir: 'asc' | 'desc' = url.searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
	const requestedPage = Number(url.searchParams.get('page'));
	const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

	const conditions = [];
	if (status !== 'all') conditions.push(eq(schema.contracts.status, status));
	if (type !== 'all') conditions.push(eq(schema.contracts.type, type));
	if (q) {
		const pattern = `%${q}%`;
		conditions.push(or(like(schema.contracts.name, pattern), like(schema.companies.name, pattern))!);
	}
	const whereClause = conditions.length ? and(...conditions) : undefined;

	const countRow = await db
		.select({ n: sql<number>`count(*)` })
		.from(schema.contracts)
		.innerJoin(schema.companies, eq(schema.companies.id, schema.contracts.companyId))
		.where(whereClause)
		.get();
	const total = countRow?.n ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const currentPage = Math.min(page, totalPages);
	const [primaryOrder, idOrder] = resolveContractOrderBy(sort, dir);

	const contracts = await db
		.select({
			id: schema.contracts.id,
			name: schema.contracts.name,
			companyName: schema.companies.name,
			status: schema.contracts.status,
			type: schema.contracts.type,
			billingModel: schema.contracts.billingModel,
			startDate: schema.contracts.startDate,
			endDate: schema.contracts.endDate,
			isDefault: schema.contracts.isDefault
		})
		.from(schema.contracts)
		.innerJoin(schema.companies, eq(schema.companies.id, schema.contracts.companyId))
		.where(whereClause)
		.orderBy(primaryOrder, idOrder)
		.limit(pageSize)
		.offset((currentPage - 1) * pageSize)
		.all();

	return {
		contracts,
		filters: { q, status, type },
		sort,
		dir,
		page: currentPage,
		pageSize,
		total,
		totalPages
	};
};

export const actions: Actions = {
	savePageSize: async ({ request, locals, platform }) => {
		const form = await request.formData();
		const pageSize = Number(form.get('pageSize'));
		if (!Number.isInteger(pageSize) || !isPageSize(pageSize)) return { success: false };
		await updateListPageSize(getDb(platform!), locals.user!.id, LIST_KEY, pageSize);
		return { success: true };
	}
};
