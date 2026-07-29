import { json } from '@sveltejs/kit';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { verifyApiKey } from '$lib/server/auth/apiKeys';
import { createTicket, foldIngestRecurrence } from '$lib/server/tickets';
import { PRIORITIES, type Priority } from '$lib/sla';

function bearerToken(request: Request): string | null {
	const header = request.headers.get('authorization');
	if (!header?.startsWith('Bearer ')) return null;
	return header.slice('Bearer '.length);
}

async function resolveIssueType(
	db: ReturnType<typeof getDb>,
	value: string | undefined
): Promise<{ id: string } | null> {
	if (!value) return null;
	const byId = await db.select({ id: schema.issueTypes.id }).from(schema.issueTypes).where(eq(schema.issueTypes.id, value)).get();
	if (byId) return byId;
	return (
		(await db
			.select({ id: schema.issueTypes.id })
			.from(schema.issueTypes)
			.where(sql`lower(${schema.issueTypes.name}) = lower(${value})`)
			.get()) ?? null
	);
}

async function resolveSubIssueType(
	db: ReturnType<typeof getDb>,
	issueTypeId: string | null,
	value: string | undefined
): Promise<{ id: string } | null> {
	if (!value || !issueTypeId) return null;
	const byId = await db
		.select({ id: schema.subIssueTypes.id })
		.from(schema.subIssueTypes)
		.where(and(eq(schema.subIssueTypes.id, value), eq(schema.subIssueTypes.issueTypeId, issueTypeId)))
		.get();
	if (byId) return byId;
	return (
		(await db
			.select({ id: schema.subIssueTypes.id })
			.from(schema.subIssueTypes)
			.where(and(eq(schema.subIssueTypes.issueTypeId, issueTypeId), sql`lower(${schema.subIssueTypes.name}) = lower(${value})`))
			.get()) ?? null
	);
}

interface IngestBody {
	companyId?: string;
	companyExternalRef?: string;
	title?: string;
	description?: string;
	priority?: string;
	issueType?: string;
	subIssueType?: string;
	externalRef?: string;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = getDb(platform!);

	const key = await verifyApiKey(db, bearerToken(request));
	if (!key) return json({ error: 'unauthorized' }, { status: 401 });

	let body: IngestBody;
	try {
		body = (await request.json()) as IngestBody;
	} catch {
		return json({ error: 'invalid JSON body' }, { status: 400 });
	}

	if (!body.title) return json({ error: 'title is required' }, { status: 400 });

	// Resolve company: companyId direct, else companyExternalRef lookup.
	let company: { id: string } | null = null;
	if (body.companyId) {
		company = (await db.select({ id: schema.companies.id }).from(schema.companies).where(eq(schema.companies.id, body.companyId)).get()) ?? null;
	} else if (body.companyExternalRef) {
		company =
			(await db
				.select({ id: schema.companies.id })
				.from(schema.companies)
				.where(eq(schema.companies.externalRef, body.companyExternalRef))
				.get()) ?? null;
	}
	if (!company) {
		return json({ error: 'company not found — provide a valid companyId or companyExternalRef' }, { status: 400 });
	}

	// Priority is required and trusted — this is what makes the ticket
	// Integration-sourced and skips Triage.
	if (!body.priority || !PRIORITIES.includes(body.priority as Priority)) {
		return json({ error: 'priority is required and must be one of: critical, high, medium, low' }, { status: 400 });
	}
	const priority = body.priority as Priority;

	// issueType/subIssueType: request value (id or name) -> key's configured
	// default -> null. No hardcoded product-wide fallback — that default
	// lives in per-key Admin config instead.
	let issueType = await resolveIssueType(db, body.issueType);
	if (!issueType && key.defaultIssueTypeId) issueType = { id: key.defaultIssueTypeId };
	let subIssueType = await resolveSubIssueType(db, issueType?.id ?? null, body.subIssueType);
	if (!subIssueType && !body.subIssueType && key.defaultSubIssueTypeId && issueType?.id === key.defaultIssueTypeId) {
		subIssueType = { id: key.defaultSubIssueTypeId };
	}

	// Dedup: retrying a push with the same externalRef while the prior ticket
	// is still open (anything short of 'closed' — see the partial
	// tickets_ingest_dedup index in db/schema.ts) folds into that ticket
	// instead of creating a duplicate. Once the prior ticket is closed, the
	// same externalRef is free to start a new one (e.g. a recurring alert).
	if (body.externalRef) {
		const existingOpen = await db
			.select({ id: schema.tickets.id, ticketNumber: schema.tickets.ticketNumber })
			.from(schema.tickets)
			.where(
				and(
					eq(schema.tickets.ingestApiKeyId, key.id),
					eq(schema.tickets.externalRef, body.externalRef),
					ne(schema.tickets.status, 'closed')
				)
			)
			.get();
		if (existingOpen) {
			await foldIngestRecurrence(db, existingOpen.id, { priority, noteResourceId: key.createdBy });
			return json({ id: existingOpen.id, ticketNumber: existingOpen.ticketNumber }, { status: 200 });
		}
	}

	const ticket = await createTicket(db, {
		title: body.title,
		description: body.description ?? null,
		companyId: company.id,
		issueTypeId: issueType?.id ?? null,
		subIssueTypeId: subIssueType?.id ?? null,
		source: 'integration',
		priority,
		ingestApiKeyId: key.id,
		externalRef: body.externalRef ?? null
	});

	return json({ id: ticket.id, ticketNumber: ticket.ticketNumber }, { status: 201 });
};
