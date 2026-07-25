import { sql } from 'drizzle-orm';
import type { Db } from './db';
import { ticketCounters } from './db/schema';

// Per-day sequential claim via a single atomic UPSERT+RETURNING (expressed
// through Drizzle's onConflictDoUpdate/.returning(), which compiles to the
// same one SQL statement) — never read-then-write. D1 serializes writes per
// database through its primary, so single-statement atomicity is the only
// guarantee needed; no app-level lock or Durable Object required. Do not
// "simplify" this into a separate SELECT followed by an UPDATE — that
// reintroduces a race under concurrent ticket creation.
export async function claimTicketNumber(db: Db, nowSeconds: number): Promise<string> {
	const d = new Date(nowSeconds * 1000);
	const dateKey = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();

	const rows = await db
		.insert(ticketCounters)
		.values({ dateKey, nextNumber: 1 })
		.onConflictDoUpdate({
			target: ticketCounters.dateKey,
			set: { nextNumber: sql`${ticketCounters.nextNumber} + 1` }
		})
		.returning({ nextNumber: ticketCounters.nextNumber });

	const claimed = rows[0]?.nextNumber;
	if (claimed == null) throw new Error('failed to claim a ticket number');

	return `T-${dateKey}-${String(claimed).padStart(4, '0')}`;
}
