import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { routingRules } from './db/schema';

const DEFAULT_FALLBACK_QUEUE_ID = 'queue-general';

// Exact (issueTypeId, subIssueTypeId) match first, then the issue-type-level
// catch-all (subIssueTypeId IS NULL), else the fallback queue. Deliberately
// decoupled from any hardcoded tiering concept — routing is purely
// issue-type driven and admin-configurable.
export async function resolveQueueForIssueType(
	db: Db,
	issueTypeId: string | null | undefined,
	subIssueTypeId: string | null | undefined,
	fallbackQueueId: string = DEFAULT_FALLBACK_QUEUE_ID
): Promise<string> {
	if (!issueTypeId) return fallbackQueueId;

	if (subIssueTypeId) {
		const exact = await db
			.select({ targetQueueId: routingRules.targetQueueId })
			.from(routingRules)
			.where(and(eq(routingRules.issueTypeId, issueTypeId), eq(routingRules.subIssueTypeId, subIssueTypeId)))
			.get();
		if (exact) return exact.targetQueueId;
	}

	const catchAll = await db
		.select({ targetQueueId: routingRules.targetQueueId })
		.from(routingRules)
		.where(and(eq(routingRules.issueTypeId, issueTypeId), isNull(routingRules.subIssueTypeId)))
		.get();
	if (catchAll) return catchAll.targetQueueId;

	return fallbackQueueId;
}
