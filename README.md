# Keep

A lightweight PSA/helpdesk tool for small MSPs — Service Desk (tickets), Dashboards, and Admin. Part of the Beacon/Keep/Sanctum suite built for Synertek Cloud Services. Intentionally scoped down from a full PSA (like Autotask): no contracts/billing/rate cards, no CRM, no projects, no knowledge base. Pay-as-you-need, no bloat.

## Stack

SvelteKit (single app, server routes + rendered pages) on Cloudflare Workers via `@sveltejs/adapter-cloudflare`, Cloudflare D1 (SQLite) via Drizzle ORM, hand-rolled session auth with optional Microsoft Entra ID SSO.

See `CLAUDE.md` for the AI-assistant-facing architecture reference and `AGENTS.md` for repo conventions/invariants.

## Local development

```bash
pnpm install
cp wrangler.jsonc.example wrangler.jsonc   # fill in your Cloudflare account/database IDs
npx wrangler types                          # generates worker-configuration.d.ts (gitignored, regenerate after editing wrangler.jsonc)
make migrate-local                          # apply D1 migrations to local SQLite
make dev                                     # vite dev server
```

First admin user is bootstrapped by hand — see `AGENTS.md` → "Bootstrapping the first admin".

## Commands

```bash
make dev              # vite dev
make build             # production build
make deploy             # build + wrangler deploy
make migrate-local      # apply pending D1 migrations locally
make migrate-remote     # apply pending D1 migrations to production
make db-generate        # drizzle-kit generate (schema.ts -> migrations/)
make type-check         # svelte-kit sync + svelte-check
make test               # vitest run
```

## License

TBD.
