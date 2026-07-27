<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { BILLING_ROUNDING_INCREMENTS } from '$lib/timeEntryBilling';
	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>
<svelte:head><title>{data.isNew ? 'New' : 'Edit'} Work Type — Keep</title></svelte:head>
<div class="pf-page">
	<div class="pf-crumb"><a href="/work-types">Work Types</a> / {data.isNew ? 'New' : data.workType?.name}</div>
	<div class="pf-topbar"><h1>{data.isNew ? 'New Work Type' : 'Edit Work Type'}</h1></div>
	{#if form?.error}<div class="error-banner">{form.error}</div>{/if}
	<form method="POST" action="?/save" class="pf-body"><div class="pf-group"><div class="pf-group-title">Details</div>
		<div class="field"><label for="name">Name</label><input id="name" name="name" value={data.workType?.name ?? ''} required /></div>
		<div class="field"><label for="code">Code</label><input id="code" name="code" value={data.workType?.code ?? ''} /></div>
		<div class="field"><label for="description">Description</label><textarea id="description" name="description" rows="3">{data.workType?.description ?? ''}</textarea></div>
		<div class="field"><label for="minimumBillableMinutes">Minimum billable minutes</label><input id="minimumBillableMinutes" name="minimumBillableMinutes" type="number" min="0" value={data.workType?.minimumBillableMinutes ?? 0} /></div>
		<div class="field"><label for="roundingMinutes">Billing rounding</label><select id="roundingMinutes" name="roundingMinutes"><option value="">Organization default</option>{#each BILLING_ROUNDING_INCREMENTS.filter((v) => v > 0) as value}<option value={value} selected={data.workType?.roundingMinutes === value}>{value} minutes</option>{/each}</select></div>
		<label class="check-row"><input type="checkbox" name="billableByDefault" checked={data.workType?.billableByDefault ?? true} /> Billable by default</label>
		<label class="check-row"><input type="checkbox" name="isDefault" checked={data.workType?.isDefault ?? false} /> Organization default</label>
		<label class="check-row"><input type="checkbox" name="isActive" checked={data.workType?.isActive ?? true} /> Active</label>
		<div class="form-actions"><a class="btn btn-ghost" href="/work-types">Cancel</a><button class="btn btn-primary" type="submit">Save</button></div>
	</div></form>
</div>
<style>.check-row{margin:10px 0}.form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}</style>
