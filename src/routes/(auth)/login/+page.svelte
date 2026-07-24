<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { form, data }: { form: ActionData; data: PageData } = $props();
	let submitting = $state(false);

	const ssoErrorMessages: Record<string, string> = {
		sso_not_configured: 'Microsoft sign-in is not configured.',
		missing_code_or_state: 'Microsoft sign-in failed — missing response data.',
		expired_or_invalid_state: 'That sign-in link expired. Please try again.',
		provider_not_found: 'Microsoft sign-in is not configured.',
		token_exchange_failed: 'Microsoft sign-in failed — could not exchange the authorization code.',
		id_token_verification_failed: 'Microsoft sign-in failed — could not verify your identity.',
		no_group_mapping: 'Your Microsoft account is not authorized for Keep — ask an admin to add a group mapping.',
		email_already_registered_locally: 'This email is already registered with a local Keep password. Log in with that instead.',
		account_disabled: 'This account has been deactivated.'
	};
</script>

<svelte:head>
	<title>Log in — Keep</title>
</svelte:head>

<div class="login-card">
	<div class="login-logo">
		<div class="login-logo-mark">K</div>
		<span class="sidebar-brand-name">Keep</span>
	</div>

	{#if form?.error}
		<div class="error-banner">{form.error}</div>
	{:else if data.ssoError}
		<div class="error-banner">{ssoErrorMessages[data.ssoError] ?? 'Sign-in failed.'}</div>
	{/if}

	<form
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<div class="field">
			<label for="email">Email</label>
			<input id="email" name="email" type="email" autocomplete="email" value={form?.email ?? ''} required />
		</div>
		<div class="field">
			<label for="password">Password</label>
			<input id="password" name="password" type="password" autocomplete="current-password" required />
		</div>
		<button class="btn btn-primary" type="submit" disabled={submitting} style="width: 100%; justify-content: center;">
			{submitting ? 'Signing in…' : 'Sign in'}
		</button>
	</form>

	{#if data.microsoftAvailable}
		<div style="margin-top: 16px; text-align: center;">
			<a class="btn btn-ghost" href="/login/microsoft" style="width: 100%; justify-content: center;">
				Sign in with Microsoft
			</a>
		</div>
	{/if}
</div>
