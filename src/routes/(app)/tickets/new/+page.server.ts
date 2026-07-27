import { fail, redirect } from '@sveltejs/kit';
import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { createTicket } from '$lib/server/tickets';
import { utcDayStart } from '$lib/server/contracts';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!);
	const companies = await db.select().from(schema.companies).orderBy(schema.companies.name).all();
	const contacts = await db.select().from(schema.contacts).all();
	const issueTypes = await db.select().from(schema.issueTypes).orderBy(schema.issueTypes.sortOrder).all();
	const subIssueTypes = await db.select().from(schema.subIssueTypes).orderBy(schema.subIssueTypes.sortOrder).all();
	const today = utcDayStart(Math.floor(Date.now() / 1000));
	const defaultContracts = await db
		.select({ id: schema.contracts.id, companyId: schema.contracts.companyId, name: schema.contracts.name })
		.from(schema.contracts)
		.where(
			and(
				eq(schema.contracts.isDefault, true),
				eq(schema.contracts.status, 'active'),
				lte(schema.contracts.startDate, today),
				or(isNull(schema.contracts.endDate), gte(schema.contracts.endDate, today))
			)
		)
		.all();
	return { companies, contacts, issueTypes, subIssueTypes, defaultContracts };
};

export const actions: Actions = {
	default: async ({ request, locals, platform }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const description = String(form.get('description') ?? '').trim() || null;
		const companyId = String(form.get('companyId') ?? '');
		const contactId = String(form.get('contactId') ?? '') || null;
		const issueTypeId = String(form.get('issueTypeId') ?? '') || null;
		const subIssueTypeId = String(form.get('subIssueTypeId') ?? '') || null;

		if (!title || !companyId) {
			return fail(400, { error: 'Title and Company are required.' });
		}

		const db = getDb(platform!);
		try {
			const ticket = await createTicket(db, {
				title,
				description,
				companyId,
				contactId,
				issueTypeId,
				subIssueTypeId,
				source: 'manual',
				createdBy: locals.user!.id
			});
			redirect(303, `/tickets/${ticket.id}`);
		} catch (e) {
			if (e instanceof Error && e.message === 'company not found') {
				return fail(400, { error: 'Selected company not found.' });
			}
			throw e;
		}
	}
};
