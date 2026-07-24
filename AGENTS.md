# Keep — AGENTS.md

Repo conventions and invariants for AI assistants working in this codebase. See `CLAUDE.md` for architecture/context.

## Migrations

- **Always** generate migrations via `make db-generate` (`drizzle-kit generate`) after editing `src/lib/server/db/schema.ts`. Never `drizzle-kit push`. Never hand-edit a migration file that's already been applied anywhere (local or remote) — edit `schema.ts` and generate a new migration instead.
- `generate` only emits DDL. If a migration needs baseline seed data (a new reference table that should ship pre-populated), hand-append the `INSERT` statements to the generated file immediately after generating it, before running `migrate-local`.
- Baseline/required seed data (SLA policy, issue taxonomy, default queue, default dashboard+widgets) lives in migrations. Demo/sample data (fictional companies/tickets for manual testing) does not exist yet in v1 — if built later, it belongs in a standalone `scripts/seed-demo.mjs`-style script, explicitly invoked, never automatic.

## Auth

- Every session-gated route relies on `locals.user`, set once in `src/hooks.server.ts`. Do not add a second, parallel way to check "is this user logged in" — if a route needs auth, it should be under `(app)/` or `(admin)/`, whose `+layout.server.ts` already gates on `locals.user`.
- Do not hand-roll a bearer-token comparison anywhere in the session-auth path. The one deliberate exception is `/api/tickets/ingest`, which uses a *separate* scheme entirely (hashed API keys, `src/lib/server/auth/apiKeys.ts`) because it authenticates external systems, not Keep users — don't conflate the two, and don't route it through `locals.user`/session cookies.
- Session tokens and API keys are never stored raw — only `sha256hex(token)`. If you're writing code that stores a token/key column, it should be named `*Hash` and the raw value should exist only transiently (in the cookie, or shown once at API-key creation).

## Ticket state machine

- Status changes go through the dedicated actions in `src/lib/server/tickets.ts` (`triageTicket`, `setStatus`, etc.), never a bare `UPDATE tickets SET status = ...`. `setStatus` validates against `TRANSITIONS` in `src/lib/sla.ts` — if you're adding a new status or transition, update `TRANSITIONS` first, don't bypass it.
- `triage` has no direct transitions in `TRANSITIONS` — leaving it must go through `triageTicket`, which is the actual enforcement of "a ticket cannot leave Triage without a priority set." Don't add a code path that sets `status` away from `triage` without also requiring `priority`.
- `responseDueAt`/`resolutionDueAt` are snapshotted once (at triage-exit or Integration-creation) and never recomputed from the current SLA policy afterward. If you're touching SLA-policy-edit code, do not make it retroactively update existing tickets' due dates — that's a deliberate invariant, not an oversight.

## Ticket numbering

- `src/lib/server/ticketNumber.ts`'s claim is a single atomic `INSERT ... ON CONFLICT ... RETURNING` statement. Do not "simplify" this into a read-then-write (`SELECT next_number` followed by a separate `UPDATE`) — that reintroduces a race condition under concurrent ticket creation that the single-statement form specifically avoids.

## Routes

- Register static path segments before parameterized ones where both exist under the same parent (SvelteKit resolves this by route specificity automatically in most cases, but keep it in mind when adding new nested routes under `tickets/[id]/`).
- `src/routes/api/` is for machine-to-machine endpoints only (currently just ticket ingestion). Don't add browser-facing pages under `api/`, and don't add machine-facing JSON endpoints under `(app)/` or `(admin)/` unless they're small helpers for client-side interactivity within a page that's otherwise `load`/`actions`-driven (e.g. the dashboard widget drag/resize PATCH) — the default for anything else is a `load`/`actions` pair, not a hand-rolled fetch API.

## Styling

- No component library, no Tailwind. Shared design tokens and a small set of generic classes (`.section-card`, `.btn*`, `.field`, `.badge*`, `.stat-grid`, `.modal*`, `.pf-*` form shell) live in `src/app.css`, ported from Beacon's `style.css` — keep these two files' token values in sync if either changes; that consistency across the product suite is intentional.
- Following Beacon's documented "duplication over sharing" convention: prefer a page repeating its own scoped `<style>` markup over inventing a new shared component for a one-off variation. The **one exception** is `src/lib/sla.ts` — SLA-state math is shared verbatim between server logic and the client-side `SlaCountdown.svelte`, because a live countdown that disagrees with the server's judgment is a correctness bug, not a style inconsistency.

## Testing

- New business logic with no Beacon precedent (state machines, date/SLA math, anything concurrency-sensitive) gets a `vitest` test in the same phase it's built, not deferred. Pure CRUD routes don't need tests — `make type-check` + manual verification is the bar there, matching Beacon's precedent.
