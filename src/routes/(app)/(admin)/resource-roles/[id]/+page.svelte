<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { formatCentsForInput } from '$lib/contracts';
	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>
<svelte:head><title>{data.isNew ? 'New' : 'Edit'} Resource Role — Keep</title></svelte:head>
<div class="pf-page"><div class="pf-crumb"><a href="/resource-roles">Resource Roles</a> / {data.isNew ? 'New' : data.resourceRole?.name}</div><div class="pf-topbar"><h1>{data.isNew ? 'New Resource Role' : 'Edit Resource Role'}</h1></div>
{#if form?.error}<div class="error-banner">{form.error}</div>{/if}
<form method="POST" action="?/save" class="pf-body"><div class="pf-group"><div class="pf-group-title">Details</div>
<div class="field"><label for="name">Name</label><input id="name" name="name" value={data.resourceRole?.name ?? ''} required /></div>
<div class="field"><label for="description">Description</label><textarea id="description" name="description" rows="3">{data.resourceRole?.description ?? ''}</textarea></div>
<div class="field"><label for="hourlyRate">Default hourly rate</label><input id="hourlyRate" name="hourlyRate" inputmode="decimal" value={formatCentsForInput(data.resourceRole?.hourlyRateCents ?? 0)} required /></div>
<label class="check-row"><input type="checkbox" name="isDefault" checked={data.resourceRole?.isDefault ?? false} /> Organization default</label>
<label class="check-row"><input type="checkbox" name="isActive" checked={data.resourceRole?.isActive ?? true} /> Active</label>
<div class="form-actions"><a class="btn btn-ghost" href="/resource-roles">Cancel</a><button class="btn btn-primary" type="submit">Save</button></div>
</div></form></div>
<style>.check-row{margin:10px 0}.form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}</style>
