# Keep — CLAUDE.md

PSA/helpdesk platform for small MSPs, built for Synertek Cloud Services (developed by CodeNexus). Sibling product to Beacon (RMM) and Sanctum, under the same org. Single SvelteKit app on Cloudflare Workers — not a split API+SPA like Beacon. See `README.md` for the human-facing overview — this file is the AI-assistant-facing architecture/convention reference.

For current session-by-session status, recent decisions, and open follow-ups, see `PROJECT_LOG.md`.

## Why SvelteKit, not Beacon's Hono+Vue split

Beacon runs a decoupled Hono API + Vue SPA because it serves a compiled, non-browser Go agent phoning home independently of any browser client. Keep has no such caller — just techs in a browser, plus structured pushes from other systems (starting with Beacon's ticket-ingestion calls). SvelteKit's server routes (`+page.server.ts` `load`/`actions`, `+server.ts`) *are* the API layer, colocated with the pages that use them — one deploy target, no CORS plumbing, no parallel hand-written API client. Everything else — D1 + Drizzle conventions, hand-rolled session auth + Entra SSO, hand-authored CSS design tokens — is carried over from Beacon deliberately, for consistency across the suite.

## Repository layout

```
migrations/    D1 SQL migrations, sequential from 0000, drizzle-kit generated (see "Migrations" below)
src/
  app.d.ts       App.Platform (D1Database + secrets), App.Locals.user
  app.css        Design tokens + shared classes, ported from Beacon's style.css
  hooks.server.ts  Resolves session cookie -> locals.user on every request
  lib/
    sla.ts         PURE — no DB. Shared between server logic and the client-side SLA countdown.
    server/
      db/            schema.ts (Drizzle) + index.ts (getDb(platform))
      auth/           session.ts, password.ts, oidc.ts, apiKeys.ts
      tickets.ts      Shared ticket core: createTicket/triage/setStatus/assign/clientReply/notes/timeEntries
      ticketNumber.ts Atomic per-day sequential numbering
      routing.ts      Issue-type -> queue resolution
      dashboardData.ts Widget aggregation queries
    components/      SlaCountdown.svelte, DonutChart.svelte
  routes/
    (auth)/          login, sso-callback — ungated
    (app)/           Service Desk + Dashboard — gated by (app)/+layout.server.ts (any logged-in user)
    (admin)/         Admin module — gated by (admin)/+layout.server.ts (role='admin' only)
    api/tickets/ingest/  External integration endpoint — API-key authenticated, NOT session-gated
```

**Local full-stack testing gotcha**: `vite dev` runs the app inside a real `workerd` process (via adapter-cloudflare's dev integration) backed by a local SQLite file under `.wrangler/state`. Killing that process with `kill -9` (or `pkill -9`) instead of a graceful signal can leave the D1 SQLite file's WAL/lock state inconsistent — the next `vite dev` start then fails immediately with `SQLITE_BUSY` ("database is locked") or `SQLITE_CANTOPEN` on every request touching the DB. Hit and fixed once already in this repo's history. Fix: stop the dev server gracefully where possible; if you're already stuck, `rm -rf .wrangler/state` and re-run `make migrate-local` (this destroys local data, so re-bootstrap the first admin user afterward — see below).

## Commands

```bash
make dev              # vite dev
make build             # production build
make deploy             # build + wrangler deploy
make migrate-local      # apply pending D1 migrations locally
make migrate-remote     # apply pending D1 migrations to production
make db-generate        # drizzle-kit generate
make type-check         # svelte-kit sync + svelte-check
make test               # vitest run
```

## Secrets — never commit these

| Secret | Where it lives |
|---|---|
| `ADMIN_SECRET` | break-glass bootstrap/recovery bearer token — set via `wrangler secret put` |
| `CONFIG_ENCRYPTION_KEY` | 32 random bytes hex, encrypts SSO provider client secrets at rest — `wrangler secret put` |

`wrangler.jsonc` and any local `.dev.vars` are gitignored (org-specific — real account/database IDs). `wrangler.jsonc.example` is the committed template. `worker-configuration.d.ts` (generated via `npx wrangler types`) is also gitignored since it's derived from `wrangler.jsonc`.

### CI (`.github/workflows/release.yml`)

Fires on merge to `main`. Repo secrets/vars needed (GitHub → Settings → Secrets/Variables):

| Name | Kind | Purpose |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | secret | `wrangler` auth for migrations + deploy |
| `WRANGLER_JSONC` | secret | Full contents of production `wrangler.jsonc`, written to disk for the ephemeral runner only |
| `PRODUCTION_WORKER_URL` | var | This app's own production origin, used for the post-deploy `/health` check |

Order: install → restore `wrangler.jsonc` → `wrangler types` → apply remote D1 migrations → build → deploy → health check. If migrations fail, deploy never runs and the previous release stays live.

## Database

Cloudflare D1 (SQLite) via Drizzle ORM, `src/lib/server/db/schema.ts` — single flat schema file, mirroring Beacon's conventions: `text('id').primaryKey()` with app-assigned `crypto.randomUUID()`, `text('col', {enum:[...]})` for enum-likes, `integer('col', {mode:'boolean'})` for booleans, all timestamps `integer` Unix-epoch seconds, `.references(..., {onDelete:'cascade'})` only for true child/junction rows, composite-PK junction tables via `primaryKey({columns:[...]})`. No `relations()` API — joins done manually with `eq`/`and`. Access via `platform.env.DB`, never a global/module-level connection.

### Migrations

**Generated via `drizzle-kit generate`, not hand-written.** This is the opposite of Beacon's current practice — Beacon's migration journal went stale at some point in its history (an artifact of manual edits/out-of-band DDL), so its `AGENTS.md` now forbids running `generate`. Keep starts clean and has no such baggage. Workflow: edit `schema.ts` → `make db-generate` → hand-append any baseline seed `INSERT`s to the newly generated file (generate only emits DDL, never data) → `make migrate-local` → `make type-check`. **Never** `drizzle-kit push`, **never** hand-edit an already-applied migration — that discipline is what keeps the journal from going stale the way Beacon's did.

Baseline seed data (Standard SLA policy, issue-type taxonomy, default "General" queue, default dashboard + 10 widgets) ships inside the relevant migrations as plain `INSERT`s with deterministic IDs, so a fresh install is immediately usable — see migrations 0001, 0002, 0007.

## Auth system

Hand-rolled, ported from Beacon's `lib/auth.ts`/`lib/password.ts`/`lib/oidc.ts` — not a library like better-auth. Own `users`/`user_sessions` tables, **2-tier role** (`admin`/`tech` — Keep's spec has no readonly/auditor use case, unlike Beacon's 3-tier).

**Transport differs from Beacon on purpose**: httpOnly session cookie, not Bearer-token-in-localStorage. SvelteKit's `load` functions run server-side before any client JS — `hooks.server.ts` needs to read the session on every request including the first SSR render, which a cookie supports and `localStorage` doesn't.

`src/hooks.server.ts` resolves the `keep_session` cookie -> `locals.user` on every request (hash the token, look up `user_sessions` joined to `users`, reject on revoked/expired/inactive). Route-group `+layout.server.ts` files do the actual gating:
- `(app)/+layout.server.ts`: redirect to `/login` if no `locals.user`.
- `(admin)/+layout.server.ts`: same, plus `error(403)` if `role !== 'admin'`.

### Microsoft Entra ID SSO

Ported from Beacon's `lib/oidc.ts` verbatim — PKCE, `sso_providers`/`sso_group_role_mappings`/`sso_login_state`/`sso_exchange_codes`. Keep authenticates independently against the **same Entra tenant/app registration** Beacon uses — a user in the mapped Entra group gets a session in both apps via their own IdP login. This is true SSO (shared IdP session) without a custom Keep↔Beacon token bridge; either app can deploy/scale/rotate independently.

### Bootstrapping the first admin

No seed admin user ships in migrations (unlike SLA/taxonomy/dashboard baseline data) — there's no safe default password to bake in. Create the first admin by hand against local/remote D1:

```bash
npx wrangler d1 execute keep --local --command "INSERT INTO users (id, email, display_name, role, is_active, password_hash, auth_source, created_at, updated_at) VALUES (...)"
```

(Generate the password hash via `src/lib/server/auth/password.ts`'s hashing function in a one-off script — never hand-write a hash.)

## Ticket lifecycle & SLA system

See `src/lib/server/tickets.ts` and `src/lib/sla.ts` for the authoritative logic. Summary:

- Manual/Email/Portal-sourced tickets enter `triage` with `priority=null`; `triageDueAt` set from the company's SLA policy. Cannot leave `triage` without a priority — enforced by a dedicated `triage` action, not a bare status PATCH.
- Integration-sourced tickets (via `/api/tickets/ingest`) arrive with a trusted priority and skip `triage` entirely; SLA clocks start immediately.
- `responseDueAt`/`resolutionDueAt` are **snapshotted** from the company's SLA policy at the moment priority is set (or at creation, for Integration tickets) — never recomputed live. Editing an SLA policy later does not retroactively change already-triaged tickets' due dates.
- `slaState()` in `src/lib/sla.ts` is pure (no DB) specifically so it can be imported both server-side and by the client-side `SlaCountdown.svelte` component for a live-ticking badge that matches the server's judgment exactly.

## Shared dashboard

One system default dashboard (`is_default=1`), normalized `dashboard_widgets` table (not a JSON blob) — mirrors Beacon's actual dashboard schema shape. Widget aggregation queries live in `src/lib/server/dashboardData.ts`. Admin-only edit (drag/resize/add/remove); techs see the same page with the edit affordance simply absent.

## Ticket ingestion API

`POST /api/tickets/ingest` — API-key authenticated (not session-gated), for internal systems (starting with Beacon) to push tickets in directly. Distinct from and much simpler than the still-deferred email-to-ticket ingestion (the `source` enum already reserves `'email'`/`'portal'` values for that future work). See `src/routes/api/tickets/ingest/+server.ts` and the Admin → API Keys page.

## Testing

Unlike Beacon (which has no automated tests at all — a defensible choice there since it's mostly CRUD/device-checkin plumbing), Keep has a narrow `vitest` + `@cloudflare/vitest-pool-workers` suite covering the business logic Beacon has no analog for: `lib/sla.ts`, `lib/server/ticketNumber.ts` (atomic sequential numbering — needs a real Miniflare D1 to test the race-freedom), `lib/server/routing.ts`, and a handful of route-level smoke tests. Everything else (admin CRUD, list/detail routes) relies on `make type-check` + manual `wrangler dev`/browser verification, same as Beacon.
