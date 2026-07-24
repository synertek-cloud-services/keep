import { defineConfig } from 'drizzle-kit';

// No `driver` set — `generate` only diffs schema.ts against migrations/, it
// doesn't need a live DB connection. `wrangler d1 migrations apply` (not
// `drizzle-kit push`) is what actually applies migrations, local or remote.
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './migrations',
	dialect: 'sqlite'
});
