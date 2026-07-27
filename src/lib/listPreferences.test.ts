import { describe, expect, it } from 'vitest';
import { getListPageSize, parseListPreferences, setListPageSize } from './listPreferences';

describe('list preferences', () => {
	it('falls back safely for missing or malformed values', () => {
		expect(parseListPreferences(null)).toEqual({});
		expect(parseListPreferences('{bad json')).toEqual({});
		expect(parseListPreferences('[]')).toEqual({});
	});

	it('drops invalid entries and page sizes', () => {
		expect(parseListPreferences('{"companies":{"pageSize":50},"users":{"pageSize":999},"bad":"value"}')).toEqual({
			companies: { pageSize: 50 }
		});
	});

	it('updates one list without discarding another', () => {
		const original = '{"users":{"pageSize":15}}';
		const updated = setListPageSize(original, 'companies', 100);
		expect(getListPageSize(updated, 'users')).toBe(15);
		expect(getListPageSize(updated, 'companies')).toBe(100);
	});
});
