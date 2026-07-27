import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	if (!locals.user) error(401, { message: 'Authentication required' });
	const db = getDb(platform!);
	const attachment = await db
		.select()
		.from(schema.attachments)
		.where(
			and(
				eq(schema.attachments.id, params.attachmentId),
				eq(schema.attachments.ticketId, params.id)
			)
		)
		.get();
	if (!attachment) error(404, { message: 'Attachment not found' });
	const object = await platform!.env.ATTACHMENTS.get(attachment.storageKey);
	if (!object) error(404, { message: 'Attachment object not found' });

	const asciiName = attachment.fileName.replace(/[^\x20-\x7e]/g, '_').replaceAll('"', "'");
	const headers = new Headers({
		'content-type': attachment.contentType,
		'content-length': String(attachment.sizeBytes),
		'content-disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
		'cache-control': 'private, no-store',
		'x-content-type-options': 'nosniff'
	});
	return new Response(object.body, { headers });
};
