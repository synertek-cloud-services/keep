#!/usr/bin/env node
/**
 * Seed a deliberately fictional Keep demo world — companies, contacts,
 * contracts, a few fictional techs, and a spread of tickets across every status/
 * priority/SLA state so the dashboard is never an empty canvas. Mirrors
 * Beacon's scripts/seed-demo.mjs pattern (same CLI shape, same reset
 * safety rules). This is never a migration: operators choose it
 * explicitly after D1 migrations have been applied.
 *
 * Demo techs are non-login fixtures (password_hash is NULL — login fails
 * cleanly, see (auth)/login/+page.server.ts) used only so ticket
 * assignment and the "Tickets per Tech" widget have something to show.
 * They do not touch or require any real bootstrapped admin account.
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { WORLDS, BLUEPRINT, validateWorld, worldNames } from './demo-worlds.mjs';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';

// Wrangler executes D1 files statement-by-statement, so foreign-key PRAGMAs
// cannot span a reset. This deliberately ordered list drops child tables
// before the parents they reference (see schema.ts for the FK graph).
const resetTables = [
	'notes', 'time_entries', 'tickets', 'contracts', 'api_keys', 'routing_rules', 'contacts', 'companies',
	'sub_issue_types', 'sla_policy_priorities', 'user_sessions', 'sso_group_role_mappings',
	'sso_login_state', 'users', 'dashboard_widgets', 'issue_types', 'queues', 'sla_policies', 'organization_settings',
	'sso_providers', 'dashboards', 'ticket_counters', 'd1_migrations'
];
const resetTableSet = new Set(resetTables);

// Standard SLA policy windows, in minutes — matches the 'sla-standard'
// baseline seeded by migration 0000 (sla_policy_priorities rows). The demo
// SLA math below assumes every seeded company uses this default policy.
const PRIORITY_WINDOWS = {
	critical: { responseMinutes: 15, resolutionMinutes: 240 },
	high: { responseMinutes: 30, resolutionMinutes: 480 },
	medium: { responseMinutes: 120, resolutionMinutes: 1440 },
	low: { responseMinutes: 240, resolutionMinutes: 4320 }
};
const TRIAGE_MINUTES = 30;

function usage() {
	console.log(`Usage: node scripts/seed-demo.mjs --world <${worldNames().join('|')}> (--local | --remote --allow-remote) [options]

Options:
  --reset          Rebuild a local D1 database from migrations before seeding.
  --yes            Required with --reset; confirms the destructive local reset.
                    NOTE: this also drops the users table — any real
                    bootstrapped admin account is deleted and must be
                    re-created afterward (see CLAUDE.md).
  --database NAME  D1 binding or database name (default: keep).
  --persist-to DIR Use a specific local Wrangler persistence directory.

Remote seed operations refuse non-empty databases. Remote reset is never allowed.`);
}

function parseArgs(args) {
	const value = (name) => {
		const index = args.indexOf(name);
		return index < 0 ? undefined : args[index + 1];
	};
	if (args.includes('--help') || args.includes('-h')) {
		usage();
		process.exit(0);
	}
	const worldName = value('--world');
	const local = args.includes('--local'),
		remote = args.includes('--remote');
	if (!worldName || !WORLDS[worldName]) {
		throw new Error(`Choose a world with --world. Available: ${worldNames().join(', ')}`);
	}
	if (local === remote) throw new Error('Choose exactly one target: --local or --remote.');
	if (remote && !args.includes('--allow-remote')) {
		throw new Error('Remote seeding requires --allow-remote and refuses non-empty databases.');
	}
	if (args.includes('--reset') && !local) {
		throw new Error('--reset is local-only. Remote databases are never reset by this tool.');
	}
	if (args.includes('--reset') && !args.includes('--yes')) {
		throw new Error('--reset is destructive. Re-run with --yes after reviewing the target.');
	}
	return {
		world: WORLDS[worldName],
		local,
		remote,
		reset: args.includes('--reset'),
		database: value('--database') ?? 'keep',
		persistTo: value('--persist-to')
	};
}

function d1Execute(options, args, capture = false) {
	const target = options.local ? ['--local'] : ['--remote'];
	if (options.local && options.persistTo) target.push('--persist-to', options.persistTo);
	try {
		const output = execFileSync('npx', ['wrangler', 'd1', 'execute', options.database, ...target, ...args], {
			cwd: root,
			encoding: capture ? 'utf8' : undefined,
			stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
		});
		return output ?? '';
	} catch (error) {
		const detail = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr).trim() : '';
		throw new Error(detail || (error instanceof Error ? error.message : String(error)));
	}
}

function temporarySql(sql, fn) {
	const directory = mkdtempSync(join(tmpdir(), 'keep-demo-world-'));
	const file = join(directory, 'seed.sql');
	try {
		writeFileSync(file, sql);
		return fn(file);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

function executeSql(options, sql) {
	return temporarySql(sql, (file) => d1Execute(options, ['--file', file], true));
}

function query(options, sql) {
	const output = d1Execute(options, ['--command', sql, '--json'], true);
	const start = output.indexOf('[');
	if (start < 0) throw new Error(`Wrangler did not return JSON for a seed preflight.\n${output}`);
	return JSON.parse(output.slice(start));
}

function rows(options, sql) {
	const result = query(options, sql);
	return result[0]?.results ?? [];
}

function quote(value) {
	return `'${String(value).replaceAll("'", "''")}'`;
}
function id(world, kind, key) {
	return `demo-${world.id}-${kind}-${key}`;
}

// SLA demo math — see demo-worlds.mjs's ROW_SLA_DEMO comment for what each
// state means. All timestamps are expressed as `unixepoch() ± N` SQL
// expressions rather than JS-computed absolute timestamps, so there's no
// clock-skew risk between this Node process and the D1/SQLite server (same
// reasoning as Beacon's seed script using unixepoch() directly).
function offset(seconds) {
	const now = 'unixepoch()';
	if (seconds === 0) return now;
	return seconds > 0 ? `${now} + ${seconds}` : `${now} - ${-seconds}`;
}

function slaExpr(priority, demoState) {
	const window = PRIORITY_WINDOWS[priority];
	const responseSec = window.responseMinutes * 60;
	const resolutionSec = window.resolutionMinutes * 60;

	switch (demoState) {
		case 'response_breached': {
			// slaClockStartedAt far enough back that the response window is
			// already 5 minutes overdue, while resolution is still comfortably
			// ahead (resolution windows are always much larger than response).
			const startedAgo = responseSec + 300;
			return {
				slaClockStartedAt: offset(-startedAgo),
				responseDueAt: offset(-300),
				resolutionDueAt: offset(resolutionSec - startedAgo),
				firstResponseAt: 'NULL'
			};
		}
		case 'response_at_risk': {
			const elapsed = Math.round(responseSec * 0.85);
			return {
				slaClockStartedAt: offset(-elapsed),
				responseDueAt: offset(responseSec - elapsed),
				resolutionDueAt: offset(resolutionSec - elapsed),
				firstResponseAt: 'NULL'
			};
		}
		case 'resolution_breached': {
			const startedAgo = resolutionSec + 1800; // 30 min past due
			return {
				slaClockStartedAt: offset(-startedAgo),
				responseDueAt: offset(responseSec - startedAgo),
				resolutionDueAt: offset(-1800),
				firstResponseAt: offset(-startedAgo + 60)
			};
		}
		case 'resolution_at_risk': {
			const elapsed = Math.round(resolutionSec * 0.85);
			return {
				slaClockStartedAt: offset(-elapsed),
				responseDueAt: offset(responseSec - elapsed),
				resolutionDueAt: offset(resolutionSec - elapsed),
				firstResponseAt: offset(-elapsed + 60)
			};
		}
		case 'on_track':
		default: {
			const elapsed = Math.round(resolutionSec * 0.1);
			return {
				slaClockStartedAt: offset(-elapsed),
				responseDueAt: offset(responseSec - elapsed),
				resolutionDueAt: offset(resolutionSec - elapsed),
				firstResponseAt: offset(-elapsed + 60)
			};
		}
	}
}

const QUEUE_GROUP = { computer: 'service-desk', server: 'service-desk', network: 'network', secops: 'security' };
const QUEUE_NAME = { 'service-desk': 'Service Desk', network: 'Network Ops', security: 'Security' };

function ticketDateKey(timezone, now = new Date()) {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(now);
	const part = (type) => parts.find((item) => item.type === type)?.value;
	return `${part('year')}${part('month')}${part('day')}`;
}

export function buildWorldSql(
	world,
	ticketStartNumber = 1,
	dateKey = ticketDateKey('UTC')
) {
	validateWorld(world);
	const now = 'unixepoch()';
	const sql = [];

	const companyId = new Map(world.companies.map((c) => [c.key, id(world, 'company', c.key)]));
	const techId = new Map(world.techs.map((t) => [t.key, id(world, 'tech', t.key)]));
	const queueId = new Map(
		Object.keys(QUEUE_NAME).map((group) => [group, id(world, 'queue', group)])
	);

	for (const company of world.companies) {
		const cid = companyId.get(company.key);
		const contractId = id(world, 'contract', company.key);
		sql.push(
			`INSERT INTO companies (id, name, type, status, sla_policy_id, default_billable, external_ref, created_at, updated_at) VALUES (${quote(cid)}, ${quote(company.name)}, 'client', 'active', 'sla-standard', 1, NULL, ${now}, ${now});`
		);
		sql.push(
			`INSERT INTO contacts (id, company_id, name, email, phone, is_primary, created_at, updated_at) VALUES (${quote(id(world, 'contact', company.key))}, ${quote(cid)}, ${quote(company.contact)}, ${quote(`${company.key}@demo.invalid`)}, NULL, 1, ${now}, ${now});`
		);
		sql.push(
			`INSERT INTO contracts (id, company_id, name, status, type, billing_model, start_date, end_date, fixed_fee_cents, included_minutes, hourly_rate_cents, is_default, created_at, updated_at) VALUES (${quote(contractId)}, ${quote(cid)}, ${quote(`${company.name} Managed Services`)}, 'active', 'recurring', 'included_hours', unixepoch(date('now', 'start of year')), unixepoch(date('now', 'start of year', '+1 year', '-1 day')), 0, 1200, 15000, 1, ${now}, ${now});`
		);
	}

	for (const tech of world.techs) {
		sql.push(
			`INSERT INTO users (id, email, display_name, role, is_active, password_hash, auth_source, created_at, updated_at) VALUES (${quote(techId.get(tech.key))}, ${quote(`${tech.key}@demo.invalid`)}, ${quote(tech.name)}, 'tech', 1, NULL, 'local', ${now}, ${now});`
		);
	}

	for (const [group, name] of Object.entries(QUEUE_NAME)) {
		sql.push(
			`INSERT INTO queues (id, name, created_at, updated_at) VALUES (${quote(queueId.get(group))}, ${quote(`${world.title} ${name}`)}, ${now}, ${now});`
		);
	}

	const creatorId = techId.get(world.techs[0].key);

	for (let i = 0; i < BLUEPRINT.rowCount; i++) {
		const ticketId = id(world, 'ticket', i);
		const ticketNumber = quote(`T-${dateKey}-${String(ticketStartNumber + i).padStart(4, '0')}`);
		const company = world.companies[BLUEPRINT.company[i]];
		const cid = companyId.get(company.key);
		const contactId = id(world, 'contact', company.key);
		const category = BLUEPRINT.category[i];
		const issueTypeId = `issue-${category}`;
		const subIssueTypeId = `sub-${category}-${BLUEPRINT.subtype[i]}`;
		const qid = queueId.get(QUEUE_GROUP[category]);
		const techKey = BLUEPRINT.tech[i] != null ? world.techs[BLUEPRINT.tech[i]].key : null;
		const assignedResourceId = techKey ? quote(techId.get(techKey)) : 'NULL';
		const status = BLUEPRINT.status[i];
		const priority = BLUEPRINT.priority[i];
		const needsAttention = BLUEPRINT.needsAttention[i] ? 1 : 0;
		const title = world.titles[i];

		if (status === 'triage') {
			const ageMinutes = BLUEPRINT.triageAgeMinutes[i];
			const createdAt = `${now} - ${ageMinutes * 60}`;
			const triageDueAt = offset(TRIAGE_MINUTES * 60 - ageMinutes * 60);
			sql.push(
				`INSERT INTO tickets (id, ticket_number, title, description, status, priority, priority_source, issue_type_id, sub_issue_type_id, queue_id, assigned_resource_id, company_id, contact_id, source, needs_tech_attention, escalated_at, triage_due_at, sla_clock_started_at, response_due_at, first_response_at, resolution_due_at, resolved_at, closed_at, created_at, updated_at, created_by, ingest_api_key_id, external_ref) VALUES (${quote(ticketId)}, ${ticketNumber}, ${quote(title)}, 'Reported via demo seed.', 'triage', NULL, NULL, ${quote(issueTypeId)}, ${quote(subIssueTypeId)}, ${quote(qid)}, NULL, ${quote(cid)}, ${quote(contactId)}, 'manual', 0, NULL, ${triageDueAt}, NULL, NULL, NULL, NULL, NULL, NULL, ${createdAt}, ${createdAt}, ${quote(creatorId)}, NULL, NULL);`
			);
			continue;
		}

		if (status === 'resolved' || status === 'closed') {
			const daysAgo = BLUEPRINT.historyDaysAgo[i];
			const createdAt = `${now} - ${daysAgo * 86400}`;
			const window = PRIORITY_WINDOWS[priority];
			const slaClockStartedAt = createdAt;
			const firstResponseAt = `${createdAt} + 900`;
			const resolutionDueAt = `${createdAt} + ${window.resolutionMinutes * 60}`;
			const responseDueAt = `${createdAt} + ${window.responseMinutes * 60}`;
			const resolvedAt = `${createdAt} + ${Math.round(window.resolutionMinutes * 30)}`; // ~half the resolution window
			const closedAt = status === 'closed' ? `${resolvedAt} + 3600` : 'NULL';
			const updatedAt = status === 'closed' ? closedAt : resolvedAt;
			sql.push(
				`INSERT INTO tickets (id, ticket_number, title, description, status, priority, priority_source, issue_type_id, sub_issue_type_id, queue_id, assigned_resource_id, company_id, contact_id, source, needs_tech_attention, escalated_at, triage_due_at, sla_clock_started_at, response_due_at, first_response_at, resolution_due_at, resolved_at, closed_at, created_at, updated_at, created_by, ingest_api_key_id, external_ref) VALUES (${quote(ticketId)}, ${ticketNumber}, ${quote(title)}, 'Reported via demo seed.', ${quote(status)}, ${quote(priority)}, 'manual', ${quote(issueTypeId)}, ${quote(subIssueTypeId)}, ${quote(qid)}, ${assignedResourceId}, ${quote(cid)}, ${quote(contactId)}, 'manual', 0, NULL, NULL, ${slaClockStartedAt}, ${responseDueAt}, ${firstResponseAt}, ${resolutionDueAt}, ${resolvedAt}, ${closedAt}, ${createdAt}, ${updatedAt}, ${quote(creatorId)}, NULL, NULL);`
			);
			continue;
		}

		// Open, triaged ticket (new/in_progress/waiting_on_client/waiting_on_vendor).
		const demoState = BLUEPRINT.slaDemo[i];
		const sla = slaExpr(priority, demoState);
		// createdAt is derived from the same offset as slaClockStartedAt — the
		// demo simplification is that every open ticket was triaged instantly
		// (slaClockStartedAt == createdAt), which is harmless: slaState() only
		// cares about the numbers, not provenance.
		const createdAt = sla.slaClockStartedAt;
		sql.push(
			`INSERT INTO tickets (id, ticket_number, title, description, status, priority, priority_source, issue_type_id, sub_issue_type_id, queue_id, assigned_resource_id, company_id, contact_id, source, needs_tech_attention, escalated_at, triage_due_at, sla_clock_started_at, response_due_at, first_response_at, resolution_due_at, resolved_at, closed_at, created_at, updated_at, created_by, ingest_api_key_id, external_ref) VALUES (${quote(ticketId)}, ${ticketNumber}, ${quote(title)}, 'Reported via demo seed.', ${quote(status)}, ${quote(priority)}, 'manual', ${quote(issueTypeId)}, ${quote(subIssueTypeId)}, ${quote(qid)}, ${assignedResourceId}, ${quote(cid)}, ${quote(contactId)}, 'manual', ${needsAttention}, NULL, NULL, ${sla.slaClockStartedAt}, ${sla.responseDueAt}, ${sla.firstResponseAt}, ${sla.resolutionDueAt}, NULL, NULL, ${createdAt}, ${createdAt}, ${quote(creatorId)}, NULL, NULL);`
		);
	}

	// Demo tickets exercise the operational Contracts workflow too: every
	// company has one eligible default contract and every seeded ticket is
	// explicitly associated with it.
	for (const company of world.companies) {
		sql.push(
			`UPDATE tickets SET contract_id = ${quote(id(world, 'contract', company.key))} WHERE company_id = ${quote(companyId.get(company.key))};`
		);
	}

	const nextNumber = ticketStartNumber + BLUEPRINT.rowCount;
	sql.push(
		`INSERT INTO ticket_counters (date_key, next_number) VALUES (${Number(dateKey)}, ${nextNumber}) ON CONFLICT(date_key) DO UPDATE SET next_number = ${nextNumber};`
	);

	return sql.join('\n');
}

function preflightEmpty(options) {
	const [state] = rows(
		options,
		'SELECT (SELECT count(*) FROM companies) AS companies, (SELECT count(*) FROM tickets) AS tickets'
	);
	if (!state || Object.values(state).some((count) => Number(count) > 0)) {
		throw new Error(
			'Refusing to seed a non-empty database (existing companies or tickets found). Use --reset --yes for a local-only rebuild, or choose a fresh remote D1 database.'
		);
	}
}

function currentTicketCounter(options, dateKey) {
	const found = rows(
		options,
		`SELECT next_number FROM ticket_counters WHERE date_key = ${Number(dateKey)}`
	);
	return found[0]?.next_number ?? 1;
}

function organizationTimezone(options) {
	const found = rows(
		options,
		"SELECT timezone FROM organization_settings WHERE id = 'organization-default'"
	);
	return found[0]?.timezone ?? 'America/Los_Angeles';
}

function resetLocal(options) {
	const existing = rows(options, "SELECT name FROM sqlite_master WHERE type = 'table'").map((row) => String(row.name));
	const unknown = existing.filter((name) => !resetTableSet.has(name) && name !== '_cf_METADATA' && !name.startsWith('sqlite_'));
	if (unknown.length) {
		throw new Error(`Local reset needs an updated dependency order for: ${unknown.join(', ')}. Refusing to partially reset the database.`);
	}
	const sql = resetTables
		.filter((name) => existing.includes(name))
		.map((name) => `DROP TABLE IF EXISTS "${name}";`)
		.join('\n');
	executeSql(options, sql);
	const args = ['migrations', 'apply', options.database, '--local'];
	if (options.persistTo) args.push('--persist-to', options.persistTo);
	try {
		execFileSync('npx', ['wrangler', 'd1', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
	} catch (error) {
		const detail = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr).trim() : '';
		throw new Error(detail || (error instanceof Error ? error.message : String(error)));
	}
}

export function run(options) {
	if (options.reset) resetLocal(options);
	preflightEmpty(options);
	const dateKey = ticketDateKey(organizationTimezone(options));
	const ticketStartNumber = currentTicketCounter(options, dateKey);
	executeSql(options, buildWorldSql(options.world, ticketStartNumber, dateKey));
	const [counts] = rows(
		options,
		'SELECT (SELECT count(*) FROM companies) AS companies, (SELECT count(*) FROM contracts) AS contracts, (SELECT count(*) FROM tickets) AS tickets, (SELECT count(*) FROM users WHERE auth_source = \'local\' AND password_hash IS NULL) AS techs'
	);
	console.log(`\nSeeded ${options.world.title}: ${counts.companies} companies, ${counts.contracts} contracts, ${counts.tickets} tickets, ${counts.techs} demo techs.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		run(parseArgs(process.argv.slice(2)));
	} catch (error) {
		console.error(`\nSeed failed: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}
