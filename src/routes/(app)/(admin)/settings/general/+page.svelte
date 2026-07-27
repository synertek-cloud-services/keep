<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { COMMON_TIMEZONES } from '$lib/timezones';
	import { BILLING_ROUNDING_INCREMENTS, TIME_ENTRY_INCREMENTS } from '$lib/timeEntryBilling';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const timeValue = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
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
			<div class="pf-group-title time-title">Time Entry</div>
			<div class="field"><span class="field-label">Working days</span><div class="day-options">{#each dayLabels as label, day}<label><input type="checkbox" name="businessDays" value={day} checked={data.businessDays.includes(day)} /> {label}</label>{/each}</div></div>
			<div class="settings-grid">
				<div class="field"><label for="businessStartMinute">Business day starts</label><input id="businessStartMinute" name="businessStartMinute" type="number" hidden value={data.businessStartMinute} /><input type="time" value={timeValue(data.businessStartMinute)} onchange={(event) => { const [h,m] = event.currentTarget.value.split(':').map(Number); const target = document.getElementById('businessStartMinute') as HTMLInputElement; target.value = String(h * 60 + m); }} /></div>
				<div class="field"><label for="businessEndMinute">Business day ends</label><input id="businessEndMinute" name="businessEndMinute" type="number" hidden value={data.businessEndMinute} /><input type="time" value={timeValue(data.businessEndMinute)} onchange={(event) => { const [h,m] = event.currentTarget.value.split(':').map(Number); const target = document.getElementById('businessEndMinute') as HTMLInputElement; target.value = String(h * 60 + m); }} /></div>
				<div class="field"><label for="timeEntryIncrementMinutes">Entry increment</label><select id="timeEntryIncrementMinutes" name="timeEntryIncrementMinutes">{#each TIME_ENTRY_INCREMENTS as value}<option value={value} selected={data.timeEntryIncrementMinutes === value}>{value} minutes</option>{/each}</select></div>
				<div class="field"><label for="billingRoundingMinutes">Default billing rounding</label><select id="billingRoundingMinutes" name="billingRoundingMinutes">{#each BILLING_ROUNDING_INCREMENTS as value}<option value={value} selected={data.billingRoundingMinutes === value}>{value === 0 ? 'No rounding' : `${value} minutes`}</option>{/each}</select></div>
			</div>
			<label class="check-row"><input type="checkbox" name="allowBillingOffset" checked={data.allowBillingOffset} /> Allow technicians to apply billing offsets</label>
			<button class="btn btn-primary" type="submit">Save Settings</button>
		</div>
	</form>
</div>

<style>
	.success-message { margin-bottom:16px; padding:10px 12px; border:1px solid var(--color-success); border-radius:var(--r-btn); color:var(--color-success); font-size:12px; }
	.field-help { margin-top:6px; max-width:620px; color:var(--color-text-muted); font-size:11px; }
	.time-title { margin-top:24px; }
	.field-label { color:var(--color-text-muted); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; }
	.day-options { display:flex; flex-wrap:wrap; gap:12px; }
	.day-options label, .check-row { display:flex; align-items:center; gap:5px; color:var(--color-text-muted); font-size:12px; }
	.settings-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 14px; }
	.check-row { margin:4px 0 18px; }
	@media(max-width:620px){.settings-grid{grid-template-columns:1fr}}
</style>
