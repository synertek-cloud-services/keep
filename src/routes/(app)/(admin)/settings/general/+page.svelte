<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { COMMON_TIMEZONES } from '$lib/timezones';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>General Settings — Keep</title></svelte:head>

<div class="pf-page">
	<div class="pf-crumb">Admin / General Settings</div>
	<div class="pf-topbar"><h1>General Settings</h1></div>

	{#if form?.error}<div class="error-banner">{form.error}</div>{/if}
	{#if form?.success}<div class="success-message">Settings saved.</div>{/if}

	<form method="POST" action="?/save" use:enhance class="pf-body">
		<div class="pf-group">
			<div class="pf-group-title">Organization</div>
			<div class="field">
				<label for="timezone">Business timezone</label>
				<input id="timezone" name="timezone" type="text" list="timezone-options" value={data.timezone} required />
				<datalist id="timezone-options">
					{#each COMMON_TIMEZONES as timezone (timezone)}<option value={timezone}></option>{/each}
				</datalist>
				<p class="field-help">
					Use an IANA timezone. Timestamps remain stored in UTC; this setting controls ticket-number calendar days and will be reused for business-day presentation and reporting.
				</p>
			</div>
			<button class="btn btn-primary" type="submit">Save Settings</button>
		</div>
	</form>
</div>

<style>
	.success-message { margin-bottom:16px; padding:10px 12px; border:1px solid var(--color-success); border-radius:var(--r-btn); color:var(--color-success); font-size:12px; }
	.field-help { margin-top:6px; max-width:620px; color:var(--color-text-muted); font-size:11px; }
</style>
