/// <reference path="../worker-configuration.d.ts" />
import type { AuthedUser } from '$lib/server/auth/session';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: AuthedUser | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			// Cloudflare.Env comes from the generated worker-configuration.d.ts
			// (run `npx wrangler types` — see README), not hand-duplicated here.
			env: Cloudflare.Env;
			cf?: Cloudflare.CfProperties;
			ctx: Cloudflare.ExecutionContext;
		}
	}
}

export {};
