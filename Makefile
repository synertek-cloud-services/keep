.PHONY: dev build deploy migrate-local migrate-remote db-generate type-check test \
        seed-demo-local seed-demo-reset test-demo-worlds

dev:
	npx vite dev

build:
	npx vite build

deploy: build
	npx wrangler deploy

migrate-local:
	npx wrangler d1 migrations apply keep --local

migrate-remote:
	npx wrangler d1 migrations apply keep --remote

db-generate:
	npx drizzle-kit generate

type-check:
	npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json

test:
	npx vitest run

# Optional fictional demo data. Choose WORLD=matrix, minecraft, holy-grail,
# fallout, or star-trek. Reset is intentionally local-only and destructive
# (it also drops the users table — re-bootstrap the first admin afterward).
WORLD ?= matrix
seed-demo-local:
	node scripts/seed-demo.mjs --world $(WORLD) --local

seed-demo-reset:
	node scripts/seed-demo.mjs --world $(WORLD) --local --reset --yes

test-demo-worlds:
	node scripts/test-demo-worlds.mjs
