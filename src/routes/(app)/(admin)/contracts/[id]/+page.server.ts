import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import {
	isBillingModel,
	isContractStatus,
	isContractType,
	parseCurrencyToCents,
	parseDateOnly,
	parseHoursToMinutes
} from '$lib/contracts';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getDb(platform!);
	const companies = await db
		.select({ id: schema.companies.id, name: schema.companies.name, status: schema.companies.status })
		.from(schema.companies)
		.orderBy(schema.companies.name)
		.all();

	if (params.id === 'new') return { isNew: true, contract: null, companies };

	const contract = await db.select().from(schema.contracts).where(eq(schema.contracts.id, params.id)).get();
	if (!contract) error(404, { message: 'Contract not found' });
	return { isNew: false, contract, companies };
};

export const actions: Actions = {
	save: async ({ request, params, platform }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const companyId = String(form.get('companyId') ?? '');
		const status = String(form.get('status') ?? '');
		const type = String(form.get('type') ?? '');
		const billingModel = String(form.get('billingModel') ?? '');
		const startDate = parseDateOnly(String(form.get('startDate') ?? ''));
		const endDateValue = String(form.get('endDate') ?? '');
		const endDate = endDateValue ? parseDateOnly(endDateValue) : null;
		const fixedFeeCents = parseCurrencyToCents(String(form.get('fixedFee') ?? '0'));
		const includedMinutes = parseHoursToMinutes(String(form.get('includedHours') ?? '0'));
		const hourlyRateCents = parseCurrencyToCents(String(form.get('hourlyRate') ?? '0'));
		const isDefault = form.get('isDefault') === 'on';

		if (!name || !companyId) return fail(400, { error: 'Contract name and company are required.' });
		if (!isContractStatus(status) || !isContractType(type) || !isBillingModel(billingModel)) {
			return fail(400, { error: 'Select a valid status, type, and billing model.' });
		}
		if (startDate == null || (endDateValue && endDate == null) || (endDate != null && endDate < startDate)) {
			return fail(400, { error: 'Enter valid dates; the end date cannot be before the start date.' });
		}
		if (fixedFeeCents == null || includedMinutes == null || hourlyRateCents == null) {
			return fail(400, { error: 'Billing amounts and included hours must be non-negative numbers.' });
		}

		const db = getDb(platform!);
		const company = await db.select({ id: schema.companies.id }).from(schema.companies).where(eq(schema.companies.id, companyId)).get();
		if (!company) return fail(400, { error: 'Select a valid company.' });

		const now = Math.floor(Date.now() / 1000);
		const isNew = params.id === 'new';
		const contractId = isNew ? crypto.randomUUID() : params.id;

		if (!isNew) {
			const existing = await db.select({ id: schema.contracts.id }).from(schema.contracts).where(eq(schema.contracts.id, contractId)).get();
			if (!existing) error(404, { message: 'Contract not found' });
		}

		if (isDefault) {
			const condition = isNew
				? eq(schema.contracts.companyId, companyId)
				: and(eq(schema.contracts.companyId, companyId), ne(schema.contracts.id, contractId));
			await db.update(schema.contracts).set({ isDefault: false, updatedAt: now }).where(condition);
		}

		const values = {
			companyId,
			name,
			status,
			type,
			billingModel,
			startDate,
			endDate,
			fixedFeeCents,
			includedMinutes,
			hourlyRateCents,
			isDefault,
			updatedAt: now
		};

		if (isNew) {
			await db.insert(schema.contracts).values({ id: contractId, ...values, createdAt: now });
		} else {
			await db.update(schema.contracts).set(values).where(eq(schema.contracts.id, contractId));
		}

		redirect(303, `/contracts/${contractId}`);
	}
};
