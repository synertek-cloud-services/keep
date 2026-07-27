# Keep

A lightweight PSA/helpdesk tool for small MSPs — Service Desk (tickets), Contracts, Dashboards, and Admin. Part of the Beacon/Keep/Sanctum suite built for Synertek Cloud Services. Intentionally scoped down from a full PSA (like Autotask): focused contract terms without a full invoicing engine, and no CRM, projects, or knowledge base. Pay-as-you-need, no bloat.

## Stack

SvelteKit (single app, server routes + rendered pages) on Cloudflare Workers via `@sveltejs/adapter-cloudflare`, Cloudflare D1 (SQLite) via Drizzle ORM, hand-rolled session auth with optional Microsoft Entra ID SSO.

See `CLAUDE.md` for the AI-assistant-facing architecture reference and `AGENTS.md` for repo conventions/invariants.

## Local development

```bash
pnpm install
cp wrangler.jsonc.example wrangler.jsonc   # fill in your Cloudflare account/database IDs
pnpm exec wrangler types                    # generates worker-configuration.d.ts (gitignored, regenerate after editing wrangler.jsonc)
pnpm exec wrangler d1 migrations apply keep --local
pnpm dev
```

First admin user is bootstrapped by hand — see `CLAUDE.md` → "Bootstrapping the first admin".

## Commands

```bash
pnpm dev                          # vite dev
pnpm build                        # production build
pnpm check                        # svelte-kit sync + svelte-check
pnpm test                         # vitest run
pnpm exec drizzle-kit generate    # schema.ts -> migrations/
pnpm exec wrangler d1 migrations apply keep --local
```

## License

TBD.
