import { describe, it, expect } from 'vitest';
import { resolveVisibleColumns, DEFAULT_TICKET_COLUMNS } from './ticketColumns';

describe('resolveVisibleColumns', () => {
	it('returns the default when prefs are null or undefined', () => {
		expect(resolveVisibleColumns(null)).toEqual(DEFAULT_TICKET_COLUMNS);
		expect(resolveVisibleColumns(undefined)).toEqual(DEFAULT_TICKET_COLUMNS);
	});

	it('returns the default when the stored JSON is malformed', () => {
		expect(resolveVisibleColumns('not json')).toEqual(DEFAULT_TICKET_COLUMNS);
	});

	it('returns the default when the stored JSON is not an array', () => {
		expect(resolveVisibleColumns('{"foo":"bar"}')).toEqual(DEFAULT_TICKET_COLUMNS);
	});

	it('filters out unknown column keys', () => {
		expect(resolveVisibleColumns(JSON.stringify(['title', 'bogus-key', 'company']))).toEqual(['title', 'company']);
	});

	it('falls back to the default when filtering leaves nothing', () => {
		expect(resolveVisibleColumns(JSON.stringify(['bogus-a', 'bogus-b']))).toEqual(DEFAULT_TICKET_COLUMNS);
	});

	it('preserves a valid custom order', () => {
		const custom = ['createdAt', 'title', 'ticketNumber'];
		expect(resolveVisibleColumns(JSON.stringify(custom))).toEqual(custom);
	});
});
