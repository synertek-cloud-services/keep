import { error, fail } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import {
	triageTicket,
	setStatus as setTicketStatus,
	assignTicket,
	markClientReplied,
	addNote,
	addTimeEntry,
	deleteTimeEntry,
	updateTicketHeader
} from '$lib/server/tickets';
import { nextValidStatuses, canLeaveTriage, type Priority, type TicketStatus } from '$lib/sla';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getDb(platform!);

	const ticket = await db.select().from(schema.tickets).where(eq(schema.tickets.id, params.id)).get();
	if (!ticket) error(404, { message: 'Ticket not found' });

	const [company, contact, queue, issueType, subIssueType, assignedResource] = await Promise.all([
		db.select().from(schema.companies).where(eq(schema.companies.id, ticket.companyId)).get(),
		ticket.contactId ? db.select().from(schema.contacts).where(eq(schema.contacts.id, ticket.contactId)).get() : null,
		db.select().from(schema.queues).where(eq(schema.queues.id, ticket.queueId)).get(),
		ticket.issueTypeId ? db.select().from(schema.issueTypes).where(eq(schema.issueTypes.id, ticket.issueTypeId)).get() : null,
		ticket.subIssueTypeId ? db.select().from(schema.subIssueTypes).where(eq(schema.subIssueTypes.id, ticket.subIssueTypeId)).get() : null,
		ticket.assignedResourceId ? db.select().from(schema.users).where(eq(schema.users.id, ticket.assignedResourceId)).get() : null
	]);

	const notes = await db
		.select({
			id: schema.notes.id,
			body: schema.notes.body,
			visibility: schema.notes.visibility,
			createdAt: schema.notes.createdAt,
			resourceName: schema.users.displayName,
			resourceEmail: schema.users.email
		})
		.from(schema.notes)
		.innerJoin(schema.users, eq(schema.users.id, schema.notes.resourceId))
		.where(eq(schema.notes.ticketId, params.id))
		.orderBy(desc(schema.notes.createdAt))
		.all();

	const timeEntries = await db
		.select({
			id: schema.timeEntries.id,
			durationMinutes: schema.timeEntries.durationMinutes,
			notes: schema.timeEntries.notes,
			workDate: schema.timeEntries.workDate,
			billable: schema.timeEntries.billable,
			resourceName: schema.users.displayName,
			resourceEmail: schema.users.email
		})
		.from(schema.timeEntries)
		.innerJoin(schema.users, eq(schema.users.id, schema.timeEntries.resourceId))
		.where(eq(schema.timeEntries.ticketId, params.id))
		.orderBy(desc(schema.timeEntries.workDate))
		.all();

	const companies = await db.select().from(schema.companies).orderBy(schema.companies.name).all();
	const contacts = await db.select().from(schema.contacts).where(eq(schema.contacts.companyId, ticket.companyId)).all();
	const issueTypes = await db.select().from(schema.issueTypes).orderBy(schema.issueTypes.sortOrder).all();
	const subIssueTypes = await db.select().from(schema.subIssueTypes).orderBy(schema.subIssueTypes.sortOrder).all();
	const queues = await db.select().from(schema.queues).orderBy(schema.queues.name).all();
	const users = await db.select().from(schema.users).where(eq(schema.users.isActive, true)).all();

	return {
		ticket,
		company,
		contact,
		queue,
		issueType,
		subIssueType,
		assignedResource,
		notes,
		timeEntries,
		companies,
		contacts,
		issueTypes,
		subIssueTypes,
		queues,
		users,
		nextStatuses: nextValidStatuses(ticket.status as TicketStatus)
	};
};

export const actions: Actions = {
	updateHeader: async ({ request, params, platform }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		if (!title) return fail(400, { error: 'Title is required.' });

		const db = getDb(platform!);
		await updateTicketHeader(db, params.id, {
			title,
			description: String(form.get('description') ?? '').trim() || null,
			companyId: String(form.get('companyId') ?? ''),
			contactId: String(form.get('contactId') ?? '') || null,
			issueTypeId: String(form.get('issueTypeId') ?? '') || null,
			subIssueTypeId: String(form.get('subIssueTypeId') ?? '') || null
		});
		return { success: true };
	},

	triage: async ({ request, params, platform }) => {
		const form = await request.formData();
		const priority = String(form.get('priority') ?? '') as Priority;
		if (!canLeaveTriage(priority)) return fail(400, { error: 'A valid priority is required to leave Triage.' });

		const db = getDb(platform!);
		try {
			await triageTicket(db, params.id, priority);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Failed to triage ticket.' });
		}
		return { success: true };
	},

	setStatus: async ({ request, params, platform }) => {
		const form = await request.formData();
		const status = String(form.get('status') ?? '') as TicketStatus;

		const db = getDb(platform!);
		try {
			await setTicketStatus(db, params.id, status);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Invalid status transition.' });
		}
		return { success: true };
	},

	assign: async ({ request, params, platform }) => {
		const form = await request.formData();
		const resourceId = String(form.get('resourceId') ?? '') || null;
		const db = getDb(platform!);
		await assignTicket(db, params.id, resourceId);
		return { success: true };
	},

	selfAssign: async ({ params, locals, platform }) => {
		const db = getDb(platform!);
		await assignTicket(db, params.id, locals.user!.id);
		return { success: true };
	},

	clientReply: async ({ params, locals, platform }) => {
		const db = getDb(platform!);
		await markClientReplied(db, params.id, locals.user!.id);
		return { success: true };
	},

	addNote: async ({ request, params, locals, platform }) => {
		const form = await request.formData();
		const body = String(form.get('body') ?? '').trim();
		const visibility = String(form.get('visibility') ?? 'internal') as 'internal' | 'client_visible';
		if (!body) return fail(400, { error: 'Note body is required.' });

		const db = getDb(platform!);
		await addNote(db, { ticketId: params.id, resourceId: locals.user!.id, body, visibility });
		return { success: true };
	},

	addTimeEntry: async ({ request, params, locals, platform }) => {
		const form = await request.formData();
		const durationMinutes = Number(form.get('durationMinutes') ?? 0);
		const workDateStr = String(form.get('workDate') ?? '');
		const notes = String(form.get('notes') ?? '').trim() || null;
		const billableRaw = form.get('billable');

		if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || !workDateStr) {
			return fail(400, { error: 'A positive duration and work date are required.' });
		}

		const db = getDb(platform!);
		await addTimeEntry(db, {
			ticketId: params.id,
			resourceId: locals.user!.id,
			durationMinutes,
			notes,
			workDate: Math.floor(new Date(workDateStr).getTime() / 1000),
			// The checkbox is always present on this form (unlike the ingest
			// API, which may genuinely omit billable and wants the company
			// default) — an unchecked box means explicitly false, not "unset".
			billable: billableRaw === 'on'
		});
		return { success: true };
	},

	deleteTimeEntry: async ({ request, platform }) => {
		const form = await request.formData();
		const entryId = String(form.get('entryId') ?? '');
		const db = getDb(platform!);
		await deleteTimeEntry(db, entryId);
		return { success: true };
	}
};
