import { describe, expect, it } from 'vitest';
import {
	formatBytes,
	parseAllowedAttachmentTypes,
	parseAttachmentTypesInput,
	safeAttachmentFileName,
	validateAttachment
} from './attachmentPolicy';

describe('attachment policy', () => {
	it('parses and deduplicates MIME types', () => {
		expect(parseAttachmentTypesInput('image/png, application/pdf\nIMAGE/PNG')).toEqual([
			'image/png',
			'application/pdf'
		]);
		expect(parseAttachmentTypesInput('not-a-mime')).toBeNull();
		expect(parseAllowedAttachmentTypes('broken')).toContain('application/pdf');
	});

	it('sanitizes path and control characters from names', () => {
		expect(safeAttachmentFileName('../folder/report\u0000.pdf')).toBe('report.pdf');
		expect(safeAttachmentFileName('')).toBe('attachment');
	});

	it('enforces size and type before upload', () => {
		const policy = { maxBytes: 1024, allowedTypes: ['application/pdf'] };
		expect(validateAttachment({ name: 'x.pdf', type: 'application/pdf', size: 100 }, policy)).toBeNull();
		expect(validateAttachment({ name: 'x.pdf', type: 'application/pdf', size: 2048 }, policy)).toContain('1 KB');
		expect(validateAttachment({ name: 'x.html', type: 'text/html', size: 100 }, policy)).toContain('not allowed');
		expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
	});
});
