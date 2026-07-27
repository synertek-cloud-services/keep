import { sqliteTable, text, integer, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ─────────────────────────────────────────────────────────────────────────
// Auth: local accounts + Microsoft Entra ID SSO
//
// 2-tier (admin | tech), not Beacon's 3-tier (admin/technician/readonly) —
// Keep's own product spec defines Resource.role as Admin/Tech only, with no
// view-only/auditor use case called for. Additive migration later if that
// changes; not worth the complexity now.
// ─────────────────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	displayName: text('display_name'),
	// Doubles as the product spec's "Resource" entity — the assignable
	// tech/admin referenced by tickets.assignedResourceId, notes.resourceId,
	// timeEntries.resourceId.
	role: text('role', { enum: ['admin', 'tech'] }).notNull().default('tech'),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	// "pbkdf2-sha256$<iterations>$<saltB64>$<hashB64>". Null for SSO-only users.
	passwordHash: text('password_hash'),
	authSource: text('auth_source', { enum: ['local', 'microsoft'] }).notNull().default('local'),
	ssoProviderId: text('sso_provider_id').references((): typeof ssoProviders.id => ssoProviders.id),
	ssoSubject: text('sso_subject'), // Entra `oid` claim; null for local accounts
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull(),
	lastLoginAt: integer('last_login_at'),
	// JSON array of TicketColumnKey (see $lib/ticketColumns.ts), in display
	// order. Null = not customized; renderer falls back to
	// DEFAULT_TICKET_COLUMNS. Server-side, per-user — not localStorage —
	// same cross-device-consistency reasoning as this app's session cookies.
	ticketColumnPrefs: text('ticket_column_prefs'),
	// One of PAGE_SIZE_OPTIONS (see $lib/ticketPageSize.ts). Null = not
	// customized; renderer falls back to DEFAULT_PAGE_SIZE. Same
	// per-user/server-side rationale as ticketColumnPrefs above.
	ticketPageSize: integer('ticket_page_size'),
	// JSON object keyed by list name for preferences shared by newer list
	// pages (currently Companies). Ticket preferences retain their original
	// dedicated columns until there is a concrete reason to migrate them.
	listPreferences: text('list_preferences')
});

export const userSessions = sqliteTable('user_sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	tokenHash: text('token_hash').notNull().unique(), // sha256hex(raw cookie value)
	createdAt: integer('created_at').notNull(),
	expiresAt: integer('expires_at').notNull(),
	lastUsedAt: integer('last_used_at'),
	revokedAt: integer('revoked_at'),
	userAgent: text('user_agent'),
	ip: text('ip')
});

export const ssoProviders = sqliteTable('sso_providers', {
	id: text('id').primaryKey(),
	type: text('type', { enum: ['microsoft'] }).notNull().default('microsoft'),
	name: text('name').notNull(),
	directoryId: text('directory_id').notNull(), // Entra tenant id
	clientId: text('client_id').notNull(),
	clientSecretCiphertext: text('client_secret_ciphertext').notNull(),
	clientSecretNonce: text('client_secret_nonce').notNull(),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const ssoGroupRoleMappings = sqliteTable('sso_group_role_mappings', {
	id: text('id').primaryKey(),
	ssoProviderId: text('sso_provider_id')
		.notNull()
		.references(() => ssoProviders.id),
	groupId: text('group_id').notNull(),
	groupName: text('group_name'),
	role: text('role', { enum: ['admin', 'tech'] }).notNull(),
	createdAt: integer('created_at').notNull()
});

export const ssoLoginState = sqliteTable('sso_login_state', {
	id: text('id').primaryKey(), // IS the `state` value sent to Microsoft
	ssoProviderId: text('sso_provider_id')
		.notNull()
		.references(() => ssoProviders.id),
	codeVerifier: text('code_verifier').notNull(),
	redirectUri: text('redirect_uri').notNull(),
	createdAt: integer('created_at').notNull(),
	expiresAt: integer('expires_at').notNull()
});

// Note: no ssoExchangeCodes table here, unlike Beacon. That table exists in
// Beacon solely because its SPA and API are cross-origin — a session token
// can never appear directly in a redirect URL, so the callback hands back a
// one-time code the SPA's JS then exchanges via a POST call. Keep is
// single-origin with cookie-based sessions: the SSO callback route sets the
// httpOnly cookie itself and redirects straight to `/`. No exchange step,
// no extra table.

// ─────────────────────────────────────────────────────────────────────────
// SLA policies & issue-type taxonomy
// ─────────────────────────────────────────────────────────────────────────

export const slaPolicies = sqliteTable('sla_policies', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	// Minutes allowed before a Manual/Email/Portal ticket must be triaged
	// (priority set). Not used for Integration-sourced tickets, which skip Triage.
	triageMinutes: integer('triage_minutes').notNull(),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

// One row per priority tier per policy — normalized rather than a JSON blob
// so the Admin UI can query/edit individual tiers directly and dashboard
// aggregation can join straight through.
export const slaPolicyPriorities = sqliteTable(
	'sla_policy_priorities',
	{
		policyId: text('policy_id')
			.notNull()
			.references(() => slaPolicies.id, { onDelete: 'cascade' }),
		priority: text('priority', { enum: ['critical', 'high', 'medium', 'low'] }).notNull(),
		responseMinutes: integer('response_minutes').notNull(),
		resolutionMinutes: integer('resolution_minutes').notNull()
	},
	(t) => [primaryKey({ columns: [t.policyId, t.priority] })]
);

export const issueTypes = sqliteTable('issue_types', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: integer('created_at').notNull()
});

export const subIssueTypes = sqliteTable('sub_issue_types', {
	id: text('id').primaryKey(),
	issueTypeId: text('issue_type_id')
		.notNull()
		.references(() => issueTypes.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: integer('created_at').notNull()
});

// ─────────────────────────────────────────────────────────────────────────
// Companies, contacts, queues, routing rules
// ─────────────────────────────────────────────────────────────────────────

export const companies = sqliteTable('companies', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	type: text('type', { enum: ['client', 'internal'] }).notNull().default('client'),
	status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
	slaPolicyId: text('sla_policy_id')
		.notNull()
		.references(() => slaPolicies.id)
		.default('sla-standard'),
	defaultBillable: integer('default_billable', { mode: 'boolean' }).notNull().default(true),
	// Cross-system mapping so an external caller (Beacon's ingest payload) can
	// reference a company without knowing Keep's internal UUID. Nullable +
	// unique when set; not tied to any one integration by name since Sanctum
	// or others may need the same seam later.
	externalRef: text('external_ref').unique(),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const contacts = sqliteTable('contacts', {
	id: text('id').primaryKey(),
	companyId: text('company_id')
		.notNull()
		.references(() => companies.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	email: text('email'),
	phone: text('phone'),
	isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const queues = sqliteTable('queues', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

// A row with subIssueTypeId = null is an issue-type-level catch-all; a row
// with it set is more specific and wins when both match (see lib/server/routing.ts).
export const routingRules = sqliteTable('routing_rules', {
	id: text('id').primaryKey(),
	issueTypeId: text('issue_type_id')
		.notNull()
		.references(() => issueTypes.id, { onDelete: 'cascade' }),
	subIssueTypeId: text('sub_issue_type_id').references(() => subIssueTypes.id, {
		onDelete: 'cascade'
	}),
	targetQueueId: text('target_queue_id')
		.notNull()
		.references(() => queues.id),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

// ─────────────────────────────────────────────────────────────────────────
// Integration API keys — for the ticket-ingestion endpoint
// ─────────────────────────────────────────────────────────────────────────

export const apiKeys = sqliteTable('api_keys', {
	id: text('id').primaryKey(),
	name: text('name').notNull(), // e.g. "Beacon" — the traceable source label
	keyHash: text('key_hash').notNull().unique(), // sha256hex(raw key); raw shown once at creation, never again
	// Applied when an ingest payload omits issueType — configured per key so
	// different integrations can default differently, rather than hardcoding
	// "SecOps" product-wide. Left both null = ticket lands with no issue type.
	defaultIssueTypeId: text('default_issue_type_id').references(() => issueTypes.id),
	defaultSubIssueTypeId: text('default_sub_issue_type_id').references(() => subIssueTypes.id),
	createdAt: integer('created_at').notNull(),
	lastUsedAt: integer('last_used_at'),
	revokedAt: integer('revoked_at'),
	createdBy: text('created_by').references(() => users.id)
});

// ─────────────────────────────────────────────────────────────────────────
// Tickets, ticket numbering, notes, time entries
// ─────────────────────────────────────────────────────────────────────────

// Per-day sequential ticket-number counter, keyed by a UTC YYYYMMDD integer
// (e.g. 20260725) — produces "T-20260725-0001". Claimed via a single atomic
// UPSERT+RETURNING statement (see lib/server/ticketNumber.ts) — never
// read-then-write. D1 serializes writes per-database through its primary, so
// a single SQL statement is race-free without an app-level lock.
export const ticketCounters = sqliteTable('ticket_counters', {
	dateKey: integer('date_key').primaryKey(),
	nextNumber: integer('next_number').notNull().default(1)
});

export const tickets = sqliteTable(
	'tickets',
	{
		id: text('id').primaryKey(),
		ticketNumber: text('ticket_number').notNull().unique(), // "T-20260725-0001"
		title: text('title').notNull(),
		description: text('description'),
		status: text('status', {
			enum: [
				'triage',
				'new',
				'in_progress',
				'waiting_on_client',
				'waiting_on_vendor',
				'resolved',
				'closed'
			]
		})
			.notNull()
			.default('triage'),
		priority: text('priority', { enum: ['critical', 'high', 'medium', 'low'] }), // null until triaged
		prioritySource: text('priority_source', { enum: ['integration', 'manual'] }),
		issueTypeId: text('issue_type_id').references(() => issueTypes.id),
		subIssueTypeId: text('sub_issue_type_id').references(() => subIssueTypes.id),
		queueId: text('queue_id')
			.notNull()
			.references(() => queues.id),
		// Null = unassigned — the "Unassigned" fast filter is `assignedResourceId IS NULL`.
		assignedResourceId: text('assigned_resource_id').references(() => users.id),
		companyId: text('company_id')
			.notNull()
			.references(() => companies.id),
		contactId: text('contact_id').references(() => contacts.id),
		source: text('source', { enum: ['manual', 'email', 'portal', 'integration'] })
			.notNull()
			.default('manual'),
		// Exists specifically so email-to-ticket ingestion can be added later
		// without a schema migration — no ingestion logic built for it in v1.
		needsTechAttention: integer('needs_tech_attention', { mode: 'boolean' })
			.notNull()
			.default(false),
		// Timestamp-as-flag rather than a bare boolean — null = not escalated,
		// set = escalated at that time.
		escalatedAt: integer('escalated_at'),

		// ── SLA clocks ──
		// Only meaningful for source != 'integration'.
		triageDueAt: integer('triage_due_at'),
		// Reference point the response/resolution SLA-state calculation measures
		// from: createdAt for Integration tickets, or the triage-exit timestamp
		// for Manual/Email/Portal tickets. Its own column because it's NOT
		// always createdAt.
		slaClockStartedAt: integer('sla_clock_started_at'),
		// SNAPSHOTTED from the company's SLA policy at the moment priority is
		// set (triage exit) or at creation (Integration) — never recomputed
		// live, so later policy edits don't retroactively change existing
		// tickets' due dates.
		responseDueAt: integer('response_due_at'),
		firstResponseAt: integer('first_response_at'),
		resolutionDueAt: integer('resolution_due_at'),

		resolvedAt: integer('resolved_at'),
		closedAt: integer('closed_at'),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull(),
		createdBy: text('created_by').references(() => users.id), // null for integration-sourced

		// ── Integration ingest provenance ──
		ingestApiKeyId: text('ingest_api_key_id').references(() => apiKeys.id),
		externalRef: text('external_ref') // e.g. Beacon's alert id — for traceability + dedup
	},
	(t) => [
		// Unique only when both are non-null (SQLite treats NULLs as distinct in
		// a unique index) — dedup scope is per-integration, doesn't collide
		// across keys or against manually-created tickets.
		uniqueIndex('tickets_ingest_dedup').on(t.ingestApiKeyId, t.externalRef)
	]
);

export const notes = sqliteTable('notes', {
	id: text('id').primaryKey(),
	ticketId: text('ticket_id')
		.notNull()
		.references(() => tickets.id, { onDelete: 'cascade' }),
	resourceId: text('resource_id')
		.notNull()
		.references(() => users.id),
	body: text('body').notNull(),
	visibility: text('visibility', { enum: ['internal', 'client_visible'] })
		.notNull()
		.default('internal'),
	createdAt: integer('created_at').notNull()
});

export const timeEntries = sqliteTable('time_entries', {
	id: text('id').primaryKey(),
	ticketId: text('ticket_id')
		.notNull()
		.references(() => tickets.id, { onDelete: 'cascade' }),
	resourceId: text('resource_id')
		.notNull()
		.references(() => users.id),
	durationMinutes: integer('duration_minutes').notNull(),
	notes: text('notes'),
	workDate: integer('work_date').notNull(), // date the work was performed, not createdAt
	// Defaults from company.defaultBillable at entry-creation time, overridable per entry.
	billable: integer('billable', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull()
});

// ─────────────────────────────────────────────────────────────────────────
// Dashboards & widgets — normalized, per Beacon's actual pattern (not a
// single JSON blob). Keep needs neither dashboard_sites (no scoping concept)
// nor multiple dashboards (v1 spec: "ONE system default dashboard").
// ─────────────────────────────────────────────────────────────────────────

export const dashboards = sqliteTable('dashboards', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const dashboardWidgets = sqliteTable('dashboard_widgets', {
	id: text('id').primaryKey(),
	dashboardId: text('dashboard_id')
		.notNull()
		.references(() => dashboards.id, { onDelete: 'cascade' }),
	type: text('type').notNull(), // see WIDGET_TYPES in lib/server/dashboardData.ts
	title: text('title'),
	config: text('config').notNull().default('{}'), // JSON, widget-specific
	gridX: integer('grid_x').notNull().default(0),
	gridY: integer('grid_y').notNull().default(0),
	gridW: integer('grid_w').notNull().default(4),
	gridH: integer('grid_h').notNull().default(3),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});
