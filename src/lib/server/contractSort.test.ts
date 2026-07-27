import { describe, expect, it } from 'vitest';
import { isContractSortKey } from './contractSort';

describe('contract sort keys', () => {
	it('accepts only supported keys', () => {
		expect(isContractSortKey('company')).toBe(true);
		expect(isContractSortKey('endDate')).toBe(true);
		expect(isContractSortKey('billingModel')).toBe(false);
		expect(isContractSortKey(null)).toBe(false);
	});
});
