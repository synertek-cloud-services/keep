export const COMMON_TIMEZONES = [
	'America/Los_Angeles',
	'America/Denver',
	'America/Chicago',
	'America/New_York',
	'America/Anchorage',
	'Pacific/Honolulu',
	'UTC'
] as const;

export function isValidIanaTimezone(value: string): boolean {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
		return true;
	} catch {
		return false;
	}
}
