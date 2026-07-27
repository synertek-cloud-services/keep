import { describe, expect, it } from 'vitest';
import { addUtcDays, zonedDateTimeToEpoch } from './timeEntryTime';

describe('time entry timezone conversion', () => {
	it('converts organization-local time to a UTC epoch', () => {
		expect(zonedDateTimeToEpoch('2026-07-27', '09:30', 'America/Los_Angeles')).toBe(
			Date.UTC(2026, 6, 27, 16, 30) / 1000
		);
	});

	it('uses the applicable daylight-saving offset', () => {
		expect(zonedDateTimeToEpoch('2026-01-27', '09:30', 'America/Los_Angeles')).toBe(
			Date.UTC(2026, 0, 27, 17, 30) / 1000
		);
	});

	it('supports explicit overnight end dates', () => {
		expect(addUtcDays('2026-07-31', 1)).toBe('2026-08-01');
	});

	it('rejects malformed input', () => {
		expect(zonedDateTimeToEpoch('nope', '09:30', 'UTC')).toBeNull();
	});
});
