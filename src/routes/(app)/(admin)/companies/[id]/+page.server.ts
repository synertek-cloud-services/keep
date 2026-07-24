import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getDb(platform!);
	const slaPolicies = await db.select().from(schema.slaPolicies).all();

	if (params.id === 'new') {
		return { isNew: true, editCompany: null, contacts: [], slaPolicies };
	}

	const editCompany = await db.select().from(schema.companies).where(eq(schema.companies.id, params.id)).get();
	if (!editCompany) error(404, { message: 'Company not found' });

	const contacts = await db.select().from(schema.contacts).where(eq(schema.contacts.companyId, params.id)).all();

	return { isNew: false, editCompany, contacts, slaPolicies };
};

export const actions: Actions = {
	save: async ({ request, params, platform }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const type = String(form.get('type') ?? 'client');
		const slaPolicyId = String(form.get('slaPolicyId') ?? 'sla-standard');
		const defaultBillable = form.get('defaultBillable') === 'on';
		const externalRef = String(form.get('externalRef') ?? '').trim() || null;

		if (!name) return fail(400, { error: 'Company name is required.' });

		const db = getDb(platform!);
		const now = Math.floor(Date.now() / 1000);
		const isNew = params.id === 'new';

		if (isNew) {
			const id = crypto.randomUUID();
			await db.insert(schema.companies).values({
				id,
				name,
				type: type as 'client' | 'internal',
				slaPolicyId,
				defaultBillable,
				externalRef,
				createdAt: now,
				updatedAt: now
			});
			redirect(303, `/companies/${id}`);
		} else {
			await db
				.update(schema.companies)
				.set({ name, type: type as 'client' | 'internal', slaPolicyId, defaultBillable, externalRef, updatedAt: now })
				.where(eq(schema.companies.id, params.id));
			redirect(303, `/companies/${params.id}`);
		}
	},

	setStatus: async ({ request, params, platform }) => {
		const form = await request.formData();
		const status = String(form.get('status') ?? 'active');
		const db = getDb(platform!);
		await db
			.update(schema.companies)
			.set({ status: status as 'active' | 'inactive', updatedAt: Math.floor(Date.now() / 1000) })
			.where(eq(schema.companies.id, params.id));
		return { success: true };
	},

	addContact: async ({ request, params, platform }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '').trim() || null;
		const phone = String(form.get('phone') ?? '').trim() || null;
		const isPrimary = form.get('isPrimary') === 'on';

		if (!name) return fail(400, { error: 'Contact name is required.' });

		const db = getDb(platform!);
		const now = Math.floor(Date.now() / 1000);
		await db.insert(schema.contacts).values({
			id: crypto.randomUUID(),
			companyId: params.id,
			name,
			email,
			phone,
			isPrimary,
			createdAt: now,
			updatedAt: now
		});
		return { success: true };
	},

	deleteContact: async ({ request, platform }) => {
		const form = await request.formData();
		const contactId = String(form.get('contactId') ?? '');
		const db = getDb(platform!);
		await db.delete(schema.contacts).where(eq(schema.contacts.id, contactId));
		return { success: true };
	}
};
