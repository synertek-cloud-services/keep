import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

// vitest-pool-workers integrates as a Vite plugin (not `test.pool`) under
// Vitest 4's reworked pool API — the plugin registers a custom poolRunner
// on the project config internally. sveltekit() is needed here too so the
// $lib alias resolves inside test files, same as it does for the app itself.
export default defineConfig({
	plugins: [
		sveltekit(),
		cloudflareTest({
			main: './tests/test-worker-entry.ts',
			wrangler: { configPath: './wrangler.jsonc' }
		})
	]
});
