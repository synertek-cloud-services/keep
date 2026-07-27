# Keep — AGENTS.md

Repository rules and invariants for AI assistants. Read `CLAUDE.md` for architecture, `PROJECT_LOG.md` for current status and open work, and `STYLE.md` before changing UI patterns.

## Architecture and workflow

- Keep is one SvelteKit app deployed to Cloudflare Workers, with Cloudflare D1 accessed through Drizzle and a private Cloudflare R2 bucket for ticket attachment bytes. Do not introduce a separate browser API/client layer: browser-facing features normally use colocated `load` functions and form actions.
- Use the repository's actual package manager (`pnpm`). This environment does not provide `make`: use `pnpm check`, `pnpm test`, `pnpm build`, `pnpm exec drizzle-kit generate`, and `pnpm exec wrangler d1 migrations apply keep --local`. Do not create `package-lock.json`.
- Access D1 from request context through `platform.env.DB`/`getDb(platform)`, never through a global or module-level connection.
- Keep `worker-configuration.d.ts` wired into `src/app.d.ts`; a clean type-check can otherwise hide missing Cloudflare ambient types.
- Never commit `wrangler.jsonc`, `.dev.vars`, `ADMIN_SECRET`, `CONFIG_ENCRYPTION_KEY`, raw session tokens, or raw API keys.

## Database and migrations

- Follow the schema conventions in `src/lib/server/db/schema.ts`: app-assigned UUID text primary keys, integer Unix timestamps, integer booleans, and explicit joins rather than Drizzle's `relations()` API.
- After editing `schema.ts`, **always** generate a migration with `pnpm exec drizzle-kit generate`. Never use `drizzle-kit push`.
- Never hand-edit a migration that may already have been applied. Make the next schema change and generate a new migration.
- Generated migrations contain DDL only. For new required baseline/reference data, append deterministic `INSERT` statements to the newly generated migration before applying it.
- Required product data belongs in migrations. Fictional/demo data belongs only in `scripts/demo-worlds.mjs` and `scripts/seed-demo.mjs`, invoked explicitly.
- `node scripts/seed-demo.mjs --world <name> --local --reset --yes` is destructive: it rebuilds local D1 and deletes real users, including the bootstrapped admin. Do not run it without explicit authorization.
- Stop `pnpm dev` gracefully. Force-killing `workerd` can corrupt/lock local D1 state. Removing `.wrangler/state` is destructive and requires re-migration and admin bootstrap.

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
- `tickets.contractId` is selected at creation or explicit ticket edit and is never recomputed when a company's default changes. A new assignment must be Active, in term, and belong to the ticket's company; the existing assignment may remain after expiry.
- Time entries snapshot the ticket's `contractId`, billing model, and hourly/overage rate at entry creation. Contract edits must not update historical time-entry billing fields.
- New time entries persist organization-local start/end input as exact UTC `startAt`/`endAt` instants and derive `durationMinutes` server-side. Never trust a client-supplied duration. `notes` is the potentially customer-facing work summary; `internalNotes` must remain separate.
- `billingOffsetMinutes` is signed and time-to-bill is `durationMinutes + billingOffsetMinutes`; validation must keep the result between zero and 24 hours. `tickets.estimatedMinutes` is optional and Time Summary derives remaining work rather than storing it.
- Keep SLA-state math in the pure shared `src/lib/sla.ts` so server decisions and `SlaCountdown.svelte` cannot diverge.
- Ticket-number claims must remain one atomic `INSERT ... ON CONFLICT ... RETURNING` statement in `src/lib/server/ticketNumber.ts`. Never replace it with read-then-write logic. The format is per-day `T-YYYYMMDD-XXXX`.
- The ticket-number date key uses the validated IANA timezone from the singleton `organization_settings` row. Keep timestamps stored in UTC; use the setting only for business-calendar boundaries/presentation. Never rewrite existing numbers after a timezone change.

## Routes and data flow

- `src/routes/api/` is for machine-to-machine endpoints. Do not place browser pages there.
- Prefer SvelteKit `load`/actions for browser workflows. A small JSON helper under a page route is acceptable only for page-local interactivity, such as dashboard drag/resize.
- Keep static path segments distinct from parameterized route usage when adding nested routes.
- Ticket sort, filter, and page state stays in URL query parameters. Only column visibility and page-size defaults are persisted per user in D1, never in `localStorage`.
- Ticket workspace layouts use the versioned contract in `src/lib/ticketWorkspace.ts`. The organization layout is the default and a nullable user layout is an override; null must continue to mean “follow the current organization default.” Validate all saved JSON through `parseTicketWorkspaceLayout` and never permit core workflow widgets to be hidden.
- Ticket detail routes belong under the standalone authenticated `(workspace)` group, not the main `(app)` shell. Ticket links should use `openTicketWorkspace()` so operational work opens separately while direct URLs remain session-gated.
- Stable pagination requires SQL filtering, `LIMIT`/`OFFSET`, a matching `COUNT(*)`, and a deterministic final order term. Ticket sorting always uses `ticketNumber` as its tiebreaker; priority uses severity order rather than alphabetic order.
- The ticket column catalog's `sortable` flags and `TicketSortKey` resolver are deliberately hand-synchronized. Do not derive one automatically from the other. SLA remains non-sortable because it is client-computed.

## Attachments

- Ticket attachment bytes live only in the private `ATTACHMENTS` R2 binding; D1's `attachments` table stores metadata, ownership, visibility, and an opaque unique `storageKey`. Never store file bodies in D1 or expose direct/public R2 URLs.
- Uploads are ticket Activity actions. Validate non-empty size, the organization-wide byte limit, and normalized MIME allowlist before writing R2. Sanitize the display filename, generate the object key server-side, and remove the R2 object if the subsequent D1 insert fails.
- Attachment downloads use the session-gated `(workspace)` route and must match both `ticketId` and `attachmentId`. Always force `Content-Disposition: attachment`, use `Cache-Control: private, no-store`, and set `X-Content-Type-Options: nosniff`.
- Internal is the safe default, matching notes. The uploader may delete their attachment; an admin may delete any. Keep both upload and delete authorization server-side even when the UI hides unavailable actions.
- Organization attachment policy lives in the singleton `organization_settings` row. Defaults are 25 MB and the MIME list in `src/lib/attachmentPolicy.ts`; parsing must fall back safely if stored JSON is malformed.
- `wrangler.jsonc.example` contains the committed R2 binding template; real `wrangler.jsonc` remains gitignored. Demo worlds do not seed attachment rows because they cannot provide matching R2 objects.

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
- Pure CRUD work generally requires `pnpm check` plus proportionate manual verification; it does not need tests solely for coverage.
- Run `pnpm test` when changing shared business logic and `pnpm check` for code changes. Run `pnpm build` when changing deployment/runtime integration or before claiming production readiness.
- Migration changes require generation, local application, type-checking, and—when risk warrants—a fresh-database migration check.
- Do not claim Entra SSO or production deployment is verified based only on compilation or dry-run. The outstanding live checks are a real Entra token exchange and a real Cloudflare deployment.

## Current direction

- V1 plus operational Contracts, organization timezone/time-entry policy, Work Types, Resource Roles, the configurable three-column ticket workspace, and secure R2-backed ticket attachments is implemented. Local demo worlds, dashboard widgets, admin CRUD, ticket ingestion, configurable ticket lists, and curated Companies/Contracts directories are also in place.
- Contract money is integer cents, included time is integer minutes, and contract dates are UTC date-only epoch seconds. Preserve those representations and the one-default-per-company unique-index invariant.
- The attachment milestone is commit `2202e09`; migration `0013_misty_eddie_brock.sql` is applied locally. At handoff, 68 tests pass, `pnpm check` reports 0 errors/0 warnings, the production build passes, and no dev server is running.
- Likely next work is attachment polish (preview/virus-scanning or richer client-visible delivery only if requirements justify it), then Timesheets, then contract consumption/invoicing rules.
- Treat `PROJECT_LOG.md` as the current handoff record and add a new newest-first entry after substantial project work or an important decision.
