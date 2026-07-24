// Test-only helper: applies the repo's D1 migrations to the Miniflare D1
// instance vitest-pool-workers spins up for each test file. Not a test
// itself — imported by test files that need a real, migrated D1 (routing,
// ticket numbering, ticket core smoke tests).
//
// Migration SQL is pulled in via import.meta.glob + `?raw` so it's resolved
// by Vite at build time — the sandboxed Workers runtime tests execute in
// doesn't have real filesystem access to read migrations/*.sql at runtime.
const migrationModules = import.meta.glob('/migrations/*.sql', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

export async function applyMigrationsForTest(db: Cloudflare.Env['DB']): Promise<void> {
	const files = Object.keys(migrationModules).sort();

	for (const file of files) {
		const sql = migrationModules[file];
		const statements = sql
			.split('--> statement-breakpoint')
			.map((s) => s.trim())
			.filter(Boolean);
		for (const statement of statements) {
			await db.prepare(statement).run();
		}
	}
}
