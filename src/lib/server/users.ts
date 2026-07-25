import { eq } from 'drizzle-orm';
import type { Db } from './db';
import * as schema from './db/schema';
import type { TicketColumnKey } from '$lib/ticketColumns';
import type { PageSize } from '$lib/ticketPageSize';

export async function updateTicketColumnPrefs(db: Db, userId: string, columns: TicketColumnKey[]): Promise<void> {
	await db
		.update(schema.users)
		.set({ ticketColumnPrefs: JSON.stringify(columns), updatedAt: Math.floor(Date.now() / 1000) })
		.where(eq(schema.users.id, userId));
}

export async function updateTicketPageSize(db: Db, userId: string, pageSize: PageSize): Promise<void> {
	await db
		.update(schema.users)
		.set({ ticketPageSize: pageSize, updatedAt: Math.floor(Date.now() / 1000) })
		.where(eq(schema.users.id, userId));
}
