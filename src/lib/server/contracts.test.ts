import { describe, expect, it } from 'vitest';
import { utcDayStart } from './contracts';

describe('contract eligibility dates', () => {
	it('normalizes timestamps to the start of their UTC date', () => {
		const timestamp = Date.UTC(2026, 6, 27, 23, 59, 59) / 1000;
		expect(utcDayStart(timestamp)).toBe(Date.UTC(2026, 6, 27) / 1000);
	});
});
