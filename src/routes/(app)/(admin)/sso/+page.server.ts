import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { encryptSecret } from '$lib/server/auth/crypto';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!);
	const provider = await db.select().from(schema.ssoProviders).where(eq(schema.ssoProviders.type, 'microsoft')).get();
	const mappings = provider
		? await db
				.select()
				.from(schema.ssoGroupRoleMappings)
				.where(eq(schema.ssoGroupRoleMappings.ssoProviderId, provider.id))
				.all()
		: [];

	return {
		provider: provider ? { id: provider.id, name: provider.name, directoryId: provider.directoryId, clientId: provider.clientId, enabled: provider.enabled } : null,
		mappings
	};
};

export const actions: Actions = {
	saveProvider: async ({ request, platform }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const directoryId = String(form.get('directoryId') ?? '').trim();
		const clientId = String(form.get('clientId') ?? '').trim();
		const clientSecret = String(form.get('clientSecret') ?? '').trim();

		if (!name || !directoryId || !clientId) {
			return fail(400, { error: 'Name, Directory (Tenant) ID, and Client ID are required.' });
		}

		const db = getDb(platform!);
		const existing = await db.select().from(schema.ssoProviders).where(eq(schema.ssoProviders.type, 'microsoft')).get();
		const now = Math.floor(Date.now() / 1000);

		if (existing && !clientSecret) {
			// Editing without providing a new secret — keep the existing one.
			await db
				.update(schema.ssoProviders)
				.set({ name, directoryId, clientId, updatedAt: now })
				.where(eq(schema.ssoProviders.id, existing.id));
			return { success: true };
		}

		if (!clientSecret) {
			return fail(400, { error: 'Client Secret is required for a new provider.' });
		}

		const { ciphertext, nonce } = await encryptSecret(clientSecret, platform!.env.CONFIG_ENCRYPTION_KEY);

		if (existing) {
			await db
				.update(schema.ssoProviders)
				.set({ name, directoryId, clientId, clientSecretCiphertext: ciphertext, clientSecretNonce: nonce, updatedAt: now })
				.where(eq(schema.ssoProviders.id, existing.id));
		} else {
			await db.insert(schema.ssoProviders).values({
				id: crypto.randomUUID(),
				type: 'microsoft',
				name,
				directoryId,
				clientId,
				clientSecretCiphertext: ciphertext,
				clientSecretNonce: nonce,
				enabled: true,
				createdAt: now,
				updatedAt: now
			});
		}

		return { success: true };
	},

	toggleEnabled: async ({ request, platform }) => {
		const form = await request.formData();
		const providerId = String(form.get('providerId') ?? '');
		const enabled = form.get('enabled') === '1';
		const db = getDb(platform!);
		await db
			.update(schema.ssoProviders)
			.set({ enabled, updatedAt: Math.floor(Date.now() / 1000) })
			.where(eq(schema.ssoProviders.id, providerId));
		return { success: true };
	},

	addMapping: async ({ request, platform }) => {
		const form = await request.formData();
		const providerId = String(form.get('providerId') ?? '');
		const groupId = String(form.get('groupId') ?? '').trim();
		const groupName = String(form.get('groupName') ?? '').trim() || null;
		const role = String(form.get('role') ?? '');

		if (!providerId || !groupId || (role !== 'admin' && role !== 'tech')) {
			return fail(400, { error: 'A group ID and role are required.' });
		}

		const db = getDb(platform!);
		await db.insert(schema.ssoGroupRoleMappings).values({
			id: crypto.randomUUID(),
			ssoProviderId: providerId,
			groupId,
			groupName,
			role,
			createdAt: Math.floor(Date.now() / 1000)
		});

		return { success: true };
	},

	deleteMapping: async ({ request, platform }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const db = getDb(platform!);
		await db.delete(schema.ssoGroupRoleMappings).where(eq(schema.ssoGroupRoleMappings.id, id));
		return { success: true };
	}
};
