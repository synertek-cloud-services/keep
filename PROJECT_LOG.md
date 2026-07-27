# Keep — Project Log

Running session-by-session log of status, decisions, and open follow-ups. Newest entries at the top.

---

## 2026-07-27 (cont'd 2) — Ticket and time-entry contract integration

Made Contracts operational in the service workflow. Shared `createTicket()` now assigns the company's default contract only when it is Active and in term on the ticket's UTC creation date, so manual and Integration ingestion behave identically. Tickets can explicitly select another eligible same-company contract; cross-company/inactive/out-of-term selection is rejected. The association is snapshotted—later default changes do not reassign existing tickets—and a current contract remains preservable after it expires.

New time entries copy the ticket's contract plus billing model and hourly/overage rate into nullable historical fields. Ticket details now show eligible contract selection and display Contract + Billing Context per time row. Migration `0007_fixed_cargill.sql` adds the nullable references/snapshot columns without rewriting old data. Tests cover default resolution, cross-company rejection, ticket association stability, UTC eligibility dates, and time-entry billing snapshots.

The demo seeder now understands the Contracts table in its safe reset dependency order and seeds one active default included-hours contract per fictional company, linking every demo ticket to its company's contract.

## 2026-07-27 (cont'd) — Contracts v1

Added the first post-v1 business module: admin-managed Contracts. Contracts belong to companies and track Draft/Active/Expired/Terminated lifecycle, Recurring/Block Hours/Time & Materials type, fixed-fee/included-hours/hourly billing model, UTC date-only terms, integer-cent fees/rates, integer-minute included time, and an optional company-default flag enforced by a partial unique index. The directory follows the curated Companies UX—search by contract/company, status/type filters, sortable headers, SQL pagination, and remembered page size—rather than adding ticket-style column configuration.

Contracts is a new top-level accordion section, validating the `NAV_SECTIONS` extension design without changes to `Sidebar.svelte`. Scope deliberately stops at term tracking: no invoicing, consumption math, or ticket/time-entry contract selection yet. Added pure date/currency/hour parsing tests and contract sort-key tests; migration `0006_wealthy_silver_sable.sql` creates the table and default-per-company index.

## 2026-07-27 — Companies directory UX

Upgraded Admin → Companies from an unbounded newest-first CRUD table to a focused directory workflow. The page now defaults to active companies alphabetically, searches by name/external reference, filters by status and type, sorts supported columns, and uses real SQL count/limit/offset pagination. Added the primary contact name/email to the curated five-column summary and distinct empty states for an empty database versus filters with no matches. Search/filter/sort/page state is URL-driven; page size is remembered server-side.

This is deliberately Autotask-informed rather than a copy: Companies does not get the ticket list's column chooser because its useful summary is small and stable. Added a generic `users.list_preferences` JSON object for page-size defaults on newer list pages while leaving the proven ticket-specific preference columns untouched. Added defensive preference parsing and company sort-key tests.

## 2026-07-25 (cont'd) — Sidebar nav redesign, ticket-list columns/sort/pagination, committed by Codex

Long session, same day as the local-dev-bootstrap/demo-data entry below. Everything landed in one commit (`ad3acad`, verified — see bottom of this entry).

**Sidebar navigation** — user's original complaint: Admin's 8 links crammed into the same flat list as Service Desk's 3. Explored Beacon's own `App.vue` sidebar first (a proven, shipped accordion pattern) rather than building the Autotask-style "swap the whole sidebar + back arrow" the user initially referenced — picked the accordion specifically because it already exists in the sibling product. Built: `src/lib/navigation.ts`'s `NAV_SECTIONS` catalog (sections can have flat `links` or labeled `groups` — Admin now clusters "Service Desk" config separately from "Access" config, after cross-checking against Autotask's own Admin→Features&Settings→"Service Desk (Tickets)" screen and confirming most of its ~15 sub-items are features Keep hasn't built, not a nav gap), `Sidebar.svelte` (the accordion component), `Icon.svelte` (hand-authored inline SVG, no icon library). Final section order per user request: Dashboard, Service Desk, Admin. Explicitly deferred: Beacon's collapsed-icon-rail/flyout mode.

**Ticket-list column chooser** — user liked Keep's existing 8 columns but wanted an Autotask-style column chooser ("not everyone needs the same columns"). Confirmed first that Keep had *no* per-user preference storage anywhere (no table, no `localStorage` usage in the whole app) — user chose server-side persistence over `localStorage`, consistent with the app's existing session-cookie-over-localStorage auth reasoning. Built `TICKET_COLUMNS` catalog (`src/lib/ticketColumns.ts`, 12 possible columns — the original 8 plus Contact/Issue Type/Source/Created, the latter two requiring new left-joins), `ColumnChooserModal.svelte` (two-pane Available/Selected picker on the existing-but-previously-unused `.modal-*` classes), persisted to a new nullable `users.ticketColumnPrefs` JSON column via a `saveColumns` form action. Default-columns fallback is exactly the original 8-in-original-order, so the feature is zero-visual-change until a user opens the chooser. Caught and fixed two real bugs before shipping: an overly-narrow TS `Set` type, and a latent bug where the modal's internal selection state only initialized once at mount and would never resync after a save (fixed with an `$effect` keyed on `open`).

**Per-day ticket numbering** — separately, user flagged the format should be `T-YYYYMMDD-XXXX` (date + daily-resetting 4-digit sequence), not the original `T-<year>-<6-digit>` per-year sequence. Renamed `ticket_counters.year` → `date_key` (a genuine rename, confirmed via drizzle-kit's interactive prompt — had to drive it through a pty since this environment has no real TTY for `drizzle-kit generate`'s prompts).

**Ticket-list sorting + pagination** — confirmed via exploration this is the *first* sort-by-column or pagination precedent anywhere in the app (every other `orderBy` call site in the codebase is hardcoded; the only `.limit()` usage is a fixed top-10 dashboard-widget helper). Real structural blocker found and fixed: the "open tickets only" default filter was a post-query JS `.filter()` on an unbounded fetch — had to move into the SQL `WHERE` clause before `LIMIT`/`OFFSET`/`COUNT(*)` could work correctly. Built `src/lib/server/ticketSort.ts` (validated sort keys → Drizzle order-by expressions; priority sorts by a SQL `CASE`-based severity rank, not alphabetically, since `'critical','high','low','medium'` alphabetical order is meaningless; every sort appends a `ticketNumber` tiebreaker so paging is stable — verified live by paging through with no skipped/duplicated rows). `sla` is deliberately not sortable (client-computed, no single stored column). Sort/page state lives in URL params, consistent with existing filters; had to also fix `quickFilter`'s full-URL-replace behavior to preserve an active sort across tab switches, since silently dropping it would've felt broken.

**Page-size selector** — follow-up ask: let users pick 15/30/100-ish rows-per-page, not just a fixed 25. Added `users.ticketPageSize` (same per-user server-side pattern as column prefs), a `PAGE_SIZE_OPTIONS = [15,25,50,100]` catalog, and a "Rows per page" dropdown in the pagination footer that applies immediately (URL param) and persists as the new default (background POST to a `savePageSize` action) in one interaction.

**Small UX iterations along the way** (all confirmed live, not just coded): moved the "Columns" button from the page header into the table's own toolbar next to the row-count badge (better matches where it's contextually relevant, per user feedback that the header placement was "not a good spot"); added an icon to the Columns button per user feedback that a text-only button was "bland."

**Codex committed everything to `main`** (commit `ad3acad`, "Expand ticket list navigation and demo tooling") after this session's work. Verified independently rather than trusting the commit blindly: working tree clean, no secrets/`wrangler.jsonc`/lockfile drift, migration journal (`_journal.json`) matches all 5 `migrations/*.sql` files present, and — the real test — applied all 5 migrations fresh to a brand-new throwaway D1 database and confirmed the resulting schema has exactly the expected columns (`users.ticket_column_prefs`, `users.ticket_page_size`, `ticket_counters.date_key` not the old `year`). Type-check and full test suite (34 tests) both pass against the committed state, not just the pre-commit working copy.

### Key decisions worth remembering
- Nav pattern: ported Beacon's accordion, not Autotask's swap-panel — reuses a proven pattern instead of introducing a third nav paradigm into the product suite.
- Per-user preferences (columns, page size) are server-side DB columns, never `localStorage` — matches this app's whole auth-transport philosophy.
- Sort/pagination/filter *state* is URL-driven and ephemeral; only the column set and page size are "sticky" per-user defaults. Don't conflate the two when extending this pattern elsewhere.
- The column-visibility catalog's `sortable` flags and the sort-resolver's key list are deliberately two hand-synced lists, not one derived from the other — a type-level derivation would let a future non-sortable column silently claim to be sortable.

### Next logical steps
1. **Extend the columns/sort/pagination pattern to at least one more list page** (Companies or Users are the next-most-likely candidates for volume) — CLAUDE.md now flags this as a proven-but-not-yet-reused pattern; the second usage is what will reveal whether `ticketSort.ts`/`ticketColumns.ts` need to become more generic or stay ticket-specific.
2. **Contracts and/or Timesheets** are the user's stated near-term roadmap modules — first real-world test of the `NAV_SECTIONS` extensibility design (should be one catalog entry + routes, no `Sidebar.svelte` changes).
3. Still outstanding from the original v1 pass (2026-07-24 entry below): a live Microsoft Entra tenant test of the actual SSO token exchange, and a real (non-dry-run) production deploy.

## 2026-07-25 — Local dev bootstrap, dashboard donut-chart fix, fictional demo-data seeding

First time actually running the app after the v1 scaffolding session — surfaced a few environment/UI gaps:

- **Local dev environment bootstrap**: `node_modules` had never been installed in this checkout. Installed with `pnpm` (the repo's actual package manager, per `pnpm-lock.yaml`/`pnpm-workspace.yaml` — an earlier `npm install` in this session was a mistake, reverted before it could commit a stray `package-lock.json`). Applied local D1 migrations and hand-bootstrapped the first admin user per the CLAUDE.md recipe.
- **Real bug found and fixed**: `DonutChart.svelte` (dashboard charts) had zero CSS anywhere in the codebase for its own classes — the `<svg>` had a `viewBox` but no constrained size, so it rendered oversized and overflowed into the legend text below. Added a scoped `<style>` block (110px fixed size, absolutely-positioned center label, flex legend) matching the rest of the app's design tokens. Verified live via a headless-Chromium login + screenshot (Playwright, installed to an isolated scratch dir — not added to `package.json`).
- **New: fictional demo-data seeding**, mirroring Beacon's `scripts/demo-worlds.mjs`/`seed-demo.mjs` pattern for suite consistency — same five themes (Matrix, Minecraft, Holy Grail, Fallout, Star Trek). `scripts/demo-worlds.mjs` defines a shared 15-row ticket "blueprint" (status/priority/category/assignment/SLA-demo-state) applied to each world's companies/techs/titles, so every dashboard widget (unassigned/untriaged/breaches-today/needs-attention/open-by-status/-priority/-queue/tickets-per-tech/SLA-at-risk) has real data regardless of which world is seeded. `scripts/seed-demo.mjs` builds and applies the SQL (mirrors Beacon's `--world`/--local`/`--remote`/`--reset` CLI and non-empty-DB refusal safety), plus `scripts/test-demo-worlds.mjs` for structural validation. New Makefile targets: `seed-demo-local`, `seed-demo-reset`, `test-demo-worlds` (`WORLD ?= matrix`).
  - Key departure from Beacon's version: the emptiness preflight checks `companies`/`tickets` counts, not `users` — Keep's demo techs are separate fictional fixtures (non-login: `password_hash` is `NULL`), so seeding coexists with an already-bootstrapped real admin. `--reset` still drops and re-migrates everything including `users`, so it does wipe a real admin — documented in the script's `--help` and the Makefile comment.
  - SLA timestamps are expressed as `unixepoch() ± N` SQL expressions (not JS-computed absolute times) specifically to avoid clock-skew between the seed script's Node process and D1/SQLite, same reasoning as Beacon's `unixepoch()`-in-SQL convention.
  - Verified live: seeded the Matrix world locally, confirmed every dashboard widget's counts against the blueprint by hand, and confirmed ticket list/detail pages render correctly (including a live "AT RISK" triage countdown) via headless-browser screenshots.

## 2026-07-24 — v1 scaffolding complete (all 11 phases)

Built out the full v1 plan end-to-end in one session, all phases verified live (dev server + Playwright + direct D1 queries), not just type-checked:

- **Repo scaffold**: SvelteKit + adapter-cloudflare, Makefile, docs (README/CLAUDE.md/AGENTS.md/STYLE.md), design tokens ported from Beacon's `style.css`.
- **Schema + migrations**: full Drizzle schema, `drizzle-kit generate`-based migrations (0000 initial schema, 0001 dropping the unused `sso_exchange_codes` table — see below), baseline seed data (Standard SLA policy, issue taxonomy, default queue, default dashboard + 10 widgets).
- **Auth**: local email/password (httpOnly cookie sessions) + Microsoft Entra ID SSO, both ported/adapted from Beacon. Simplified the SSO callback vs. Beacon's version — no exchange-code dance needed since Keep is single-origin (that whole mechanism exists in Beacon only because its SPA and API are cross-origin).
- **Admin CRUD**: Users, Companies+Contacts, Queues, SLA Policies+priorities, Issue Types+Sub-types, Routing Rules — all with `[id]`-unifies-create/edit routing (not separate `/new` routes).
- **Ticket core**: full state machine, SLA snapshot-at-triage-exit logic, atomic per-year ticket numbering, routing-rule application. The SLA-snapshot invariant (policy edits don't retroactively affect already-triaged tickets) was explicitly tested live, not just assumed.
- **Ticket ingestion API**: `POST /api/tickets/ingest`, API-key authenticated, with per-key default issue type and `externalRef`-based dedup. Admin API Keys page (reveal-once key display).
- **Dashboard**: all 10 default widgets with real server-computed aggregation, admin drag/resize/add/remove editing, tech read-only view enforced both in UI and server-side (403 on direct navigation).
- **Testing**: 28 vitest tests (pure `sla.ts` logic, ticket-numbering concurrency/atomicity against a real Miniflare D1, routing precedence, ticket-core state-machine smoke tests).
- **CI/deploy**: `.github/workflows/release.yml`, `/health` route, verified with a real `vite build` + `wrangler deploy --dry-run` (not just written and assumed correct).

**Two real bugs caught during live testing** (both fixed): an unchecked billable checkbox was being read as "unset" and falling back to the company default instead of `false`; work-date display was off by one day due to UTC-midnight storage rendered in local time.

**One real type-safety gap found and fixed**: `worker-configuration.d.ts` (generated via `wrangler types`) sits at the project root, which SvelteKit's generated tsconfig never includes by default — so `Cloudflare.Env`/`platform.env` typing was silently broken everywhere, hidden only by `skipLibCheck` suppressing errors inside `.d.ts` files. Fixed via a triple-slash reference in `app.d.ts`. Worth remembering: a "0 type errors" result on this stack doesn't guarantee ambient Cloudflare types are actually wired in — check for exactly this class of silent gap if `platform.env.X` ever seems to type as `any`.

**Local dev gotcha hit and documented** (see CLAUDE.md): `kill -9`ing the `vite dev`/`workerd` process can leave the local D1 SQLite file's WAL in a locked state, causing every next `vite dev` start to fail with `SQLITE_BUSY`/`SQLITE_CANTOPEN`. Fix is `rm -rf .wrangler/state` + re-migrate + re-bootstrap.

**Not yet done** (intentionally out of this pass, no code exists for these): real Microsoft Entra app registration testing (the OIDC code path compiles and the zero-providers-configured UI state works, but no live Entra tenant was available to test the actual token exchange); a demo-data seed script (`scripts/seed-demo.mjs`-equivalent) — deferred per the original plan, not required for v1; actually deploying to a real Cloudflare account (only `--dry-run` was possible here).

## 2026-07-24 — v1 scaffolding kicked off

Initial project scaffold: SvelteKit (adapter-cloudflare) + D1/Drizzle + hand-rolled auth, mirroring Beacon's D1/auth/styling conventions but as a single SvelteKit app rather than Beacon's split Hono API + Vue SPA (Keep has no compiled-agent caller forcing that split). Full plan at the time of this commit: `/home/jeremys/.claude/plans/keep-v1-scaffolding-streamed-willow.md`.

Key decisions locked in during planning (see plan doc for full reasoning):
- **DB**: Cloudflare D1 + Drizzle, not Postgres/Neon — matches Beacon, avoids a second stateful external dependency for no concrete v1 need.
- **Auth**: hand-rolled (ported from Beacon), not better-auth — httpOnly session cookie instead of Beacon's Bearer/localStorage, since SvelteKit's server `load` needs a server-readable session on first render.
- **Migrations**: `drizzle-kit generate`, not hand-written SQL — opposite of Beacon's current practice, which is itself a recovery workaround for stale migration-journal metadata that Keep, starting clean, has no reason to inherit.
- **New in v1** (user amendment mid-planning): structured `POST /api/tickets/ingest` API-key-authenticated endpoint so Beacon can push tickets directly, plus an Admin API Keys page. Distinct from and much simpler than deferred email-to-ticket ingestion.

Next: work through the phase list in the plan doc (schema/migrations → auth → SSO → admin CRUD → ticket core → ingestion API → dashboard → tests → CI/deploy → full E2E pass).
