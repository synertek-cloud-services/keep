export const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_TYPES = ['recurring', 'block_hours', 'time_and_materials'] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const BILLING_MODELS = ['fixed_fee', 'included_hours', 'hourly'] as const;
export type BillingModel = (typeof BILLING_MODELS)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
	draft: 'Draft',
	active: 'Active',
	expired: 'Expired',
	terminated: 'Terminated'
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
	recurring: 'Recurring',
	block_hours: 'Block Hours',
	time_and_materials: 'Time & Materials'
};

export const BILLING_MODEL_LABELS: Record<BillingModel, string> = {
	fixed_fee: 'Fixed Fee',
	included_hours: 'Included Hours',
	hourly: 'Hourly'
};

export function isContractStatus(value: string): value is ContractStatus {
	return (CONTRACT_STATUSES as readonly string[]).includes(value);
}

export function isContractType(value: string): value is ContractType {
	return (CONTRACT_TYPES as readonly string[]).includes(value);
}

export function isBillingModel(value: string): value is BillingModel {
	return (BILLING_MODELS as readonly string[]).includes(value);
}

export function parseDateOnly(value: string): number | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const [year, month, day] = value.split('-').map(Number);
	const timestamp = Date.UTC(year, month - 1, day) / 1000;
	const date = new Date(timestamp * 1000);
	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
	return timestamp;
}

export function formatDateOnly(timestamp: number | null | undefined): string {
	return timestamp == null ? '' : new Date(timestamp * 1000).toISOString().slice(0, 10);
}

export function parseCurrencyToCents(value: string): number | null {
	const trimmed = value.trim();
	if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
	const [whole, fraction = ''] = trimmed.split('.');
	const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
	return Number.isSafeInteger(cents) ? cents : null;
}

export function formatCentsForInput(cents: number): string {
	return (cents / 100).toFixed(2);
}

export function parseHoursToMinutes(value: string): number | null {
	const hours = Number(value);
	if (!Number.isFinite(hours) || hours < 0) return null;
	const minutes = Math.round(hours * 60);
	return Number.isSafeInteger(minutes) ? minutes : null;
}
