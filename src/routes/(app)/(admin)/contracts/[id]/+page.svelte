<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import {
		BILLING_MODELS,
		BILLING_MODEL_LABELS,
		CONTRACT_STATUSES,
		CONTRACT_STATUS_LABELS,
		CONTRACT_TYPES,
		CONTRACT_TYPE_LABELS,
		formatCentsForInput,
		formatDateOnly
	} from '$lib/contracts';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let billingModel = $state('included_hours');

	$effect(() => {
		billingModel = data.contract?.billingModel ?? 'included_hours';
	});

	const today = new Date().toISOString().slice(0, 10);
</script>

<svelte:head><title>{data.isNew ? 'New Contract' : 'Edit Contract'} — Keep</title></svelte:head>

<div class="pf-page">
	<div class="pf-crumb"><a href="/contracts">Contracts</a> / {data.isNew ? 'New' : data.contract?.name}</div>
	<div class="pf-topbar"><h1>{data.isNew ? 'New Contract' : 'Edit Contract'}</h1></div>

	{#if form?.error}<div class="error-banner">{form.error}</div>{/if}

	{#if data.companies.length === 0}
		<div class="error-banner">Create a company before creating a contract.</div>
	{:else}
		<form method="POST" action="?/save" use:enhance class="pf-body">
			<div class="pf-group">
				<div class="pf-group-title">Contract</div>
				<div class="form-grid">
					<div class="field field-wide">
						<label for="name">Contract name</label>
						<input id="name" name="name" type="text" value={data.contract?.name ?? ''} required />
					</div>
					<div class="field field-wide">
						<label for="companyId">Company</label>
						<select id="companyId" name="companyId" required>
							{#each data.companies as company (company.id)}
								<option value={company.id} selected={company.id === data.contract?.companyId}>
									{company.name}{company.status === 'inactive' ? ' (Inactive)' : ''}
								</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label for="status">Status</label>
						<select id="status" name="status">
							{#each CONTRACT_STATUSES as status (status)}
								<option value={status} selected={(data.contract?.status ?? 'draft') === status}>{CONTRACT_STATUS_LABELS[status]}</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label for="type">Contract type</label>
						<select id="type" name="type">
							{#each CONTRACT_TYPES as type (type)}
								<option value={type} selected={(data.contract?.type ?? 'recurring') === type}>{CONTRACT_TYPE_LABELS[type]}</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label for="startDate">Start date</label>
						<input id="startDate" name="startDate" type="date" value={formatDateOnly(data.contract?.startDate) || today} required />
					</div>
					<div class="field">
						<label for="endDate">End date (optional)</label>
						<input id="endDate" name="endDate" type="date" value={formatDateOnly(data.contract?.endDate)} />
					</div>
				</div>
				<label class="checkbox-row">
					<input name="isDefault" type="checkbox" checked={data.contract?.isDefault ?? false} />
					<span>
						<strong>Default contract for this company</strong>
						<small>New company work can select this contract automatically in a future ticket/time-entry workflow.</small>
					</span>
				</label>
			</div>

			<div class="pf-group">
				<div class="pf-group-title">Billing</div>
				<div class="field">
					<label for="billingModel">Billing model</label>
					<select id="billingModel" name="billingModel" bind:value={billingModel}>
						{#each BILLING_MODELS as model (model)}<option value={model}>{BILLING_MODEL_LABELS[model]}</option>{/each}
					</select>
				</div>

				{#if billingModel === 'fixed_fee'}
					<div class="field">
						<label for="fixedFee">Fixed fee ($)</label>
						<input id="fixedFee" name="fixedFee" type="number" min="0" step="0.01" value={formatCentsForInput(data.contract?.fixedFeeCents ?? 0)} required />
					</div>
				{:else if billingModel === 'included_hours'}
					<div class="form-grid">
						<div class="field">
							<label for="includedHours">Included hours</label>
							<input id="includedHours" name="includedHours" type="number" min="0" step="0.25" value={(data.contract?.includedMinutes ?? 0) / 60} required />
						</div>
						<div class="field">
							<label for="hourlyRate">Overage rate ($/hour)</label>
							<input id="hourlyRate" name="hourlyRate" type="number" min="0" step="0.01" value={formatCentsForInput(data.contract?.hourlyRateCents ?? 0)} required />
						</div>
					</div>
				{:else}
					<div class="field">
						<label for="hourlyRate">Hourly rate ($/hour)</label>
						<input id="hourlyRate" name="hourlyRate" type="number" min="0" step="0.01" value={formatCentsForInput(data.contract?.hourlyRateCents ?? 0)} required />
					</div>
				{/if}
			</div>

			<button class="btn btn-primary" type="submit">{data.isNew ? 'Create Contract' : 'Save'}</button>
		</form>
	{/if}
</div>

<style>
	.form-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:0 18px; }
	.field-wide { grid-column:1 / -1; }
	.checkbox-row { display:flex; align-items:flex-start; gap:9px; margin-top:8px; color:var(--color-text); font-size:12px; }
	.checkbox-row input { margin-top:2px; }
	.checkbox-row span { display:grid; gap:3px; }
	.checkbox-row small { color:var(--color-text-muted); font-weight:400; }
	@media (max-width:680px) {
		.form-grid { grid-template-columns:1fr; }
		.field-wide { grid-column:auto; }
	}
</style>
