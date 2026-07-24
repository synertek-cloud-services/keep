// Minimal Worker entrypoint used only by vitest-pool-workers to provide the
// isolate test files run inside — the real app entrypoint is SvelteKit's
// build output (.svelte-kit/cloudflare/_worker.js), which doesn't exist
// until `vite build` runs, so tests use this trivial stand-in instead.
// Bindings (D1, etc.) still come from wrangler.jsonc.
export default {
	async fetch() {
		return new Response('test worker', { status: 200 });
	}
};
