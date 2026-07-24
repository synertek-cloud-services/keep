.PHONY: dev build deploy migrate-local migrate-remote db-generate type-check test

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
