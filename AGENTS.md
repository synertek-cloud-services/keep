# Keep — AGENTS.md

Repository rules and invariants for AI assistants. Read `CLAUDE.md` for architecture, `PROJECT_LOG.md` for current status and open work, and `STYLE.md` before changing UI patterns.

## Architecture and workflow

- Keep is one SvelteKit app deployed to Cloudflare Workers, with Cloudflare D1 accessed through Drizzle. Do not introduce a separate browser API/client layer: browser-facing features normally use colocated `load` functions and form actions.
- Use the repository's actual package manager (`pnpm`) and the Makefile entry points: `make type-check`, `make test`, `make build`, and the database targets documented below. Do not create `package-lock.json`.
- Access D1 from request context through `platform.env.DB`/`getDb(platform)`, never through a global or module-level connection.
- Keep `worker-configuration.d.ts` wired into `src/app.d.ts`; a clean type-check can otherwise hide missing Cloudflare ambient types.
- Never commit `wrangler.jsonc`, `.dev.vars`, `ADMIN_SECRET`, `CONFIG_ENCRYPTION_KEY`, raw session tokens, or raw API keys.

## Database and migrations

- Follow the schema conventions in `src/lib/server/db/schema.ts`: app-assigned UUID text primary keys, integer Unix timestamps, integer booleans, and explicit joins rather than Drizzle's `relations()` API.
- After editing `schema.ts`, **always** generate a migration with `make db-generate` (`drizzle-kit generate`). Never use `drizzle-kit push`.
- Never hand-edit a migration that may already have been applied. Make the next schema change and generate a new migration.
- Generated migrations contain DDL only. For new required baseline/reference data, append deterministic `INSERT` statements to the newly generated migration before applying it.
- Required product data belongs in migrations. Fictional/demo data belongs only in `scripts/demo-worlds.mjs` and `scripts/seed-demo.mjs`, invoked explicitly.
- `make seed-demo-reset` is destructive: it rebuilds local D1 and deletes real users, including the bootstrapped admin. Do not run it without explicit authorization.
- Stop `make dev` gracefully. Force-killing `workerd` can corrupt/lock local D1 state. Removing `.wrangler/state` is destructive and requires re-migration and admin bootstrap.

## Authentication and authorization

- `src/hooks.server.ts` is the single session-resolution path and sets `locals.user`. Session-gated routes belong under `(app)/`; admin-only routes belong under `(admin)/`. Rely on their `+layout.server.ts` gates rather than adding parallel auth checks.
- Browser sessions use the `keep_session` httpOnly cookie. Do not add bearer-token or `localStorage` session auth.
- `/api/tickets/ingest` is the deliberate exception: it authenticates external systems with hashed API keys from `src/lib/server/auth/apiKeys.ts`, not Keep users. Do not route it through session auth.
- Store only `sha256hex(token)`/`sha256hex(key)`, in columns named `*Hash`. Raw credentials may exist only transiently in a cookie or reveal-once response.
- Keep the two roles (`admin` and `tech`) unless requirements explicitly change.

## Ticket lifecycle, SLA, and numbering

- All status changes go through the operations in `src/lib/server/tickets.ts`, such as `triageTicket` and `setStatus`; never issue a bare status update.
- `setStatus` must enforce `TRANSITIONS` from `src/lib/sla.ts`. Update that transition table when deliberately changing the state machine rather than bypassing it.
- A ticket cannot leave `triage` without a priority. `triage` intentionally has no ordinary transition; use `triageTicket`.
- Integration tickets may start outside triage only because their priority is trusted and their SLA clocks begin at creation.
- `responseDueAt` and `resolutionDueAt` are snapshots taken at triage exit or integration creation. SLA policy edits must never recalculate existing ticket deadlines.
- Keep SLA-state math in the pure shared `src/lib/sla.ts` so server decisions and `SlaCountdown.svelte` cannot diverge.
- Ticket-number claims must remain one atomic `INSERT ... ON CONFLICT ... RETURNING` statement in `src/lib/server/ticketNumber.ts`. Never replace it with read-then-write logic. The format is per-day `T-YYYYMMDD-XXXX`.

## Routes and data flow

- `src/routes/api/` is for machine-to-machine endpoints. Do not place browser pages there.
- Prefer SvelteKit `load`/actions for browser workflows. A small JSON helper under a page route is acceptable only for page-local interactivity, such as dashboard drag/resize.
- Keep static path segments distinct from parameterized route usage when adding nested routes.
- Ticket sort, filter, and page state stays in URL query parameters. Only column visibility and page-size defaults are persisted per user in D1, never in `localStorage`.
- Stable pagination requires SQL filtering, `LIMIT`/`OFFSET`, a matching `COUNT(*)`, and a deterministic final order term. Ticket sorting always uses `ticketNumber` as its tiebreaker; priority uses severity order rather than alphabetic order.
- The ticket column catalog's `sortable` flags and `TicketSortKey` resolver are deliberately hand-synchronized. Do not derive one automatically from the other. SLA remains non-sortable because it is client-computed.

## Navigation and styling

- There is no component library or Tailwind. Use the tokens and generic classes in `src/app.css`, and keep shared token values synchronized with Beacon's `style.css`.
- Consult `STYLE.md` and the reference implementation before extending an established pattern: list cards, full-page forms, modals, accordion navigation, column chooser, sortable headers, or pagination.
- Prefer scoped, page-local CSS duplication for one-off variations over creating premature shared components. Promote only genuine reusable patterns, then document them in `STYLE.md`.
- Navigation is catalog-driven by `NAV_SECTIONS` in `src/lib/navigation.ts`. Add a top-level module there and add its routes; do not hard-code it into `Sidebar.svelte`.
- Sidebar sections can use flat links or labeled groups and can be open simultaneously. Do not convert the established accordion into a single-open accordion.
- Icons are statically authored in `Icon.svelte`; do not add an icon-library dependency or inject SVG with `{@html}`.
- For list customization, follow the ticket list: stable typed catalogs, defensive preference parsing with safe defaults, server persistence, and render-by-key switching.

## Testing and verification

- Add Vitest coverage in the same change for new business logic without a Beacon precedent, especially state machines, SLA/date math, routing, and concurrency-sensitive behavior.
- Pure CRUD work generally requires `make type-check` plus proportionate manual verification; it does not need tests solely for coverage.
- Run `make test` when changing shared business logic and `make type-check` for code changes. Run `make build` when changing deployment/runtime integration or before claiming production readiness.
- Migration changes require generation, local application, type-checking, and—when risk warrants—a fresh-database migration check.
- Do not claim Entra SSO or production deployment is verified based only on compilation or dry-run. The outstanding live checks are a real Entra token exchange and a real Cloudflare deployment.

## Current direction

- V1 is implemented, with 38 tests, local demo worlds, dashboard widgets, admin CRUD, ticket ingestion, the configurable ticket-list pattern, and the curated Companies directory pattern.
- Likely next work is improving the Users list or adding Contracts and/or Timesheets through the catalog-driven navigation.
- Treat `PROJECT_LOG.md` as the current handoff record and add a new newest-first entry after substantial project work or an important decision.
