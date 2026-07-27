const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string): Intl.DateTimeFormat {
	let value = formatterCache.get(timezone);
	if (!value) {
		value = new Intl.DateTimeFormat('en-US', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		});
		formatterCache.set(timezone, value);
	}
	return value;
}

export function zonedDateTimeToEpoch(date: string, time: string, timezone: string): number | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
	if (!match || !timeMatch) return null;
	const desired = [
		Number(match[1]),
		Number(match[2]),
		Number(match[3]),
		Number(timeMatch[1]),
		Number(timeMatch[2])
	];
	if (
		desired[1] < 1 ||
		desired[1] > 12 ||
		desired[2] < 1 ||
		desired[2] > 31 ||
		desired[3] > 23 ||
		desired[4] > 59
	)
		return null;

	let guess = Date.UTC(desired[0], desired[1] - 1, desired[2], desired[3], desired[4]);
	for (let attempt = 0; attempt < 3; attempt++) {
		const parts = formatter(timezone).formatToParts(new Date(guess));
		const part = (type: Intl.DateTimeFormatPartTypes) =>
			Number(parts.find((item) => item.type === type)?.value);
		const rendered = Date.UTC(
			part('year'),
			part('month') - 1,
			part('day'),
			part('hour'),
			part('minute')
		);
		const delta = Date.UTC(desired[0], desired[1] - 1, desired[2], desired[3], desired[4]) - rendered;
		if (delta === 0) return Math.floor(guess / 1000);
		guess += delta;
	}
	return null;
}

export function addUtcDays(date: string, days: number): string | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	if (!match) return null;
	const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
	return value.toISOString().slice(0, 10);
}
