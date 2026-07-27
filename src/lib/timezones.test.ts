import { describe, expect, it } from 'vitest';
import { isValidIanaTimezone } from './timezones';

describe('IANA timezone validation', () => {
	it('accepts real zones and rejects unknown values', () => {
		expect(isValidIanaTimezone('America/Los_Angeles')).toBe(true);
		expect(isValidIanaTimezone('UTC')).toBe(true);
		expect(isValidIanaTimezone('Pacific/Not_A_Real_Place')).toBe(false);
	});
});
