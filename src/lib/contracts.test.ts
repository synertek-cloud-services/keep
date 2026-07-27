import { describe, expect, it } from 'vitest';
import {
	formatDateOnly,
	parseCurrencyToCents,
	parseDateOnly,
	parseHoursToMinutes
} from './contracts';

describe('contract value parsing', () => {
	it('parses and formats real date-only values in UTC', () => {
		const value = parseDateOnly('2026-07-27');
		expect(value).not.toBeNull();
		expect(formatDateOnly(value)).toBe('2026-07-27');
		expect(parseDateOnly('2026-02-30')).toBeNull();
	});

	it('parses currency without floating-point rounding', () => {
		expect(parseCurrencyToCents('125')).toBe(12_500);
		expect(parseCurrencyToCents('125.5')).toBe(12_550);
		expect(parseCurrencyToCents('125.55')).toBe(12_555);
		expect(parseCurrencyToCents('12.555')).toBeNull();
		expect(parseCurrencyToCents('-1')).toBeNull();
	});

	it('converts fractional included hours to minutes', () => {
		expect(parseHoursToMinutes('1.5')).toBe(90);
		expect(parseHoursToMinutes('0')).toBe(0);
		expect(parseHoursToMinutes('-2')).toBeNull();
	});
});
