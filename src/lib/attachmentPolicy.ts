export const DEFAULT_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const DEFAULT_ALLOWED_ATTACHMENT_TYPES = [
	'application/pdf',
	'image/png',
	'image/jpeg',
	'text/plain',
	'text/csv',
	'application/zip'
];

export function parseAllowedAttachmentTypes(value: string | null | undefined): string[] {
	try {
		const parsed: unknown = JSON.parse(value ?? '');
		if (Array.isArray(parsed)) {
			const normalized = parsed
				.filter((item): item is string => typeof item === 'string')
				.map((item) => item.trim().toLowerCase())
				.filter((item) => /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(item));
			if (normalized.length) return [...new Set(normalized)];
		}
	} catch {
		// Use safe defaults when stored policy JSON is malformed.
	}
	return [...DEFAULT_ALLOWED_ATTACHMENT_TYPES];
}

export function parseAttachmentTypesInput(value: string): string[] | null {
	const values = value
		.split(/[\n,]/)
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
	if (!values.length) return null;
	if (!values.every((item) => /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(item)))
		return null;
	return [...new Set(values)];
}

export function safeAttachmentFileName(value: string): string {
	const basename = value.replaceAll('\\', '/').split('/').pop() ?? '';
	const cleaned = basename.replace(/[\u0000-\u001f\u007f]/g, '').trim();
	return (cleaned || 'attachment').slice(0, 255);
}

export function validateAttachment(
	file: Pick<File, 'name' | 'type' | 'size'>,
	policy: { maxBytes: number; allowedTypes: string[] }
): string | null {
	if (file.size <= 0) return 'Choose a non-empty file.';
	if (file.size > policy.maxBytes) return `File exceeds the ${formatBytes(policy.maxBytes)} limit.`;
	const type = file.type.trim().toLowerCase() || 'application/octet-stream';
	if (!policy.allowedTypes.includes(type)) return `Files of type ${type} are not allowed.`;
	return null;
}

export function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
	if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${bytes} B`;
}
