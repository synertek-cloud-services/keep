export const TIME_ENTRY_INCREMENTS = [1, 5, 10, 15, 30] as const;
export const BILLING_ROUNDING_INCREMENTS = [0, 5, 6, 10, 15, 30, 60] as const;
export const DEFAULT_BUSINESS_DAYS = [1, 2, 3, 4, 5];

export interface BillingRule {
	minimumBillableMinutes: number;
	roundingMinutes: number;
}

export function calculateBillableMinutes(
	durationMinutes: number,
	offsetMinutes: number,
	rule: BillingRule
): number {
	const adjusted = Math.max(0, durationMinutes + offsetMinutes);
	if (adjusted === 0) return 0;
	const minimum = Math.max(0, rule.minimumBillableMinutes);
	const rounding = Math.max(0, rule.roundingMinutes);
	const afterMinimum = Math.max(adjusted, minimum);
	return rounding > 0 ? Math.ceil(afterMinimum / rounding) * rounding : afterMinimum;
}

export function parseBusinessDays(value: string | null | undefined): number[] {
	try {
		const parsed: unknown = JSON.parse(value ?? '');
		if (
			Array.isArray(parsed) &&
			parsed.length > 0 &&
			parsed.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
		) {
			return [...new Set(parsed as number[])].sort();
		}
	} catch {
		// Fall through to the safe organization default.
	}
	return [...DEFAULT_BUSINESS_DAYS];
}

export function isValidBusinessSchedule(
	days: number[],
	startMinute: number,
	endMinute: number
): boolean {
	return (
		days.length > 0 &&
		days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
		Number.isInteger(startMinute) &&
		Number.isInteger(endMinute) &&
		startMinute >= 0 &&
		endMinute <= 1440 &&
		startMinute < endMinute
	);
}
