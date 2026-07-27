import { and, eq, like, or, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { getListPageSize } from '$lib/listPreferences';
import { isPageSize, resolvePageSize } from '$lib/ticketPageSize';
import { isCompanySortKey, resolveCompanyOrderBy } from '$lib/server/companySort';
import { updateListPageSize } from '$lib/server/users';

const LIST_KEY = 'companies';

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
	const status: 'active' | 'inactive' | 'all' =
		statusParam === 'inactive' || statusParam === 'all' ? statusParam : 'active';
	const typeParam = url.searchParams.get('type');
	const type: 'client' | 'internal' | 'all' =
		typeParam === 'client' || typeParam === 'internal' ? typeParam : 'all';

	const sortParam = url.searchParams.get('sort');
	const sort = isCompanySortKey(sortParam) ? sortParam : 'name';
	const dirParam = url.searchParams.get('dir');
	const dir: 'asc' | 'desc' = dirParam === 'desc' ? 'desc' : 'asc';

	const requestedPage = Number(url.searchParams.get('page'));
	const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

	const conditions = [];
	if (status !== 'all') conditions.push(eq(schema.companies.status, status));
	if (type !== 'all') conditions.push(eq(schema.companies.type, type));
	if (q) {
		const pattern = `%${q}%`;
		conditions.push(or(like(schema.companies.name, pattern), like(schema.companies.externalRef, pattern))!);
	}
	const whereClause = conditions.length ? and(...conditions) : undefined;

	const countRow = await db.select({ n: sql<number>`count(*)` }).from(schema.companies).where(whereClause).get();
	const total = countRow?.n ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const currentPage = Math.min(page, totalPages);
	const [primaryOrder, nameOrder, idOrder] = resolveCompanyOrderBy(sort, dir);

	const companies = await db
		.select({
			id: schema.companies.id,
			name: schema.companies.name,
			type: schema.companies.type,
			status: schema.companies.status,
			slaPolicyName: schema.slaPolicies.name,
			primaryContactName: sql<string | null>`(
				SELECT ${schema.contacts.name}
				FROM ${schema.contacts}
				WHERE ${schema.contacts.companyId} = ${schema.companies.id}
					AND ${schema.contacts.isPrimary} = 1
				ORDER BY ${schema.contacts.createdAt}, ${schema.contacts.id}
				LIMIT 1
			)`,
			primaryContactEmail: sql<string | null>`(
				SELECT ${schema.contacts.email}
				FROM ${schema.contacts}
				WHERE ${schema.contacts.companyId} = ${schema.companies.id}
					AND ${schema.contacts.isPrimary} = 1
				ORDER BY ${schema.contacts.createdAt}, ${schema.contacts.id}
				LIMIT 1
			)`
		})
		.from(schema.companies)
		.leftJoin(schema.slaPolicies, eq(schema.slaPolicies.id, schema.companies.slaPolicyId))
		.where(whereClause)
		.orderBy(primaryOrder, nameOrder, idOrder)
		.limit(pageSize)
		.offset((currentPage - 1) * pageSize)
		.all();

	return {
		companies,
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

		const db = getDb(platform!);
		await updateListPageSize(db, locals.user!.id, LIST_KEY, pageSize);
		return { success: true };
	}
};
