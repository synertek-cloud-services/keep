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
export function ticketDateKey(nowSeconds: number, timezone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		calendar: 'gregory',
		numberingSystem: 'latn'
	}).formatToParts(new Date(nowSeconds * 1000));
	const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
	const year = value('year');
	const month = value('month');
	const day = value('day');
	if (!year || !month || !day) throw new Error('failed to resolve ticket date in organization timezone');
	return Number(`${year}${month}${day}`);
}

export async function claimTicketNumber(db: Db, nowSeconds: number, timezone = 'UTC'): Promise<string> {
	const dateKey = ticketDateKey(nowSeconds, timezone);

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
