import { describe, expect, it } from 'vitest';
import { isCompanySortKey } from './companySort';

describe('company sort keys', () => {
	it('accepts only supported keys', () => {
		expect(isCompanySortKey('name')).toBe(true);
		expect(isCompanySortKey('slaPolicy')).toBe(true);
		expect(isCompanySortKey('createdAt')).toBe(false);
		expect(isCompanySortKey(null)).toBe(false);
	});
});
