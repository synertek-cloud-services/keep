import { describe, expect, it } from 'vitest';
import {
	calculateBillableMinutes,
	isValidBusinessSchedule,
	parseBusinessDays
} from './timeEntryBilling';

describe('calculateBillableMinutes', () => {
	it('applies offset, minimum, then rounding', () => {
		expect(calculateBillableMinutes(22, -2, { minimumBillableMinutes: 30, roundingMinutes: 15 })).toBe(30);
		expect(calculateBillableMinutes(31, 4, { minimumBillableMinutes: 0, roundingMinutes: 15 })).toBe(45);
	});

	it('never produces negative billable time', () => {
		expect(calculateBillableMinutes(10, -30, { minimumBillableMinutes: 15, roundingMinutes: 15 })).toBe(0);
	});

	it('does not round when rounding is disabled', () => {
		expect(calculateBillableMinutes(22, 3, { minimumBillableMinutes: 0, roundingMinutes: 0 })).toBe(25);
	});
});

describe('business schedule validation', () => {
	it('parses unique valid days and falls back safely', () => {
		expect(parseBusinessDays('[5,1,1,3]')).toEqual([1, 3, 5]);
		expect(parseBusinessDays('bad')).toEqual([1, 2, 3, 4, 5]);
	});

	it('requires at least one day and an ordered in-day window', () => {
		expect(isValidBusinessSchedule([1, 2, 3, 4, 5], 480, 1080)).toBe(true);
		expect(isValidBusinessSchedule([], 480, 1080)).toBe(false);
		expect(isValidBusinessSchedule([1], 1080, 480)).toBe(false);
	});
});
