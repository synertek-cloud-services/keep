# Keep — Project Log

Running session-by-session log of status, decisions, and open follow-ups. Newest entries at the top.

---

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
