<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Work Types — Keep</title></svelte:head>
<div class="pf-topbar"><div><div class="pf-crumb">Admin / Service Desk</div><h1>Work Types</h1></div><a class="btn btn-primary" href="/work-types/new">New Work Type</a></div>
<div class="section-card">
	<div class="section-card-head"><span class="section-card-title">Work Types</span><span class="row-count-badge">{data.workTypes.length}</span></div>
	<table><thead><tr><th>Name</th><th>Code</th><th>Billing</th><th>Minimum</th><th>Rounding</th><th>Status</th></tr></thead><tbody>
		{#each data.workTypes as item}<tr><td><a href={`/work-types/${item.id}`}>{item.name}</a>{#if item.isDefault} <span class="badge badge-info">Default</span>{/if}</td><td>{item.code ?? '—'}</td><td>{item.billableByDefault ? 'Billable' : 'Non-billable'}</td><td>{item.minimumBillableMinutes} min</td><td>{item.roundingMinutes ? `${item.roundingMinutes} min` : 'Organization default'}</td><td><span class="badge" class:badge-success={item.isActive} class:badge-muted={!item.isActive}>{item.isActive ? 'Active' : 'Inactive'}</span></td></tr>
		{:else}<tr><td colspan="6" class="empty">No work types yet.</td></tr>{/each}
	</tbody></table>
</div>
