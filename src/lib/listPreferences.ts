import { isPageSize, type PageSize } from './ticketPageSize';

export type ListPreferences = Record<string, { pageSize?: PageSize }>;

export function parseListPreferences(value: string | null | undefined): ListPreferences {
	if (!value) return {};
	try {
		const parsed: unknown = JSON.parse(value);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

		const preferences: ListPreferences = {};
		for (const [key, entry] of Object.entries(parsed)) {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
			const pageSize = Number((entry as { pageSize?: unknown }).pageSize);
			if (Number.isInteger(pageSize) && isPageSize(pageSize)) preferences[key] = { pageSize };
		}
		return preferences;
	} catch {
		return {};
	}
}

export function getListPageSize(value: string | null | undefined, listKey: string): PageSize | undefined {
	return parseListPreferences(value)[listKey]?.pageSize;
}

export function setListPageSize(value: string | null | undefined, listKey: string, pageSize: PageSize): string {
	const preferences = parseListPreferences(value);
	preferences[listKey] = { ...preferences[listKey], pageSize };
	return JSON.stringify(preferences);
}
