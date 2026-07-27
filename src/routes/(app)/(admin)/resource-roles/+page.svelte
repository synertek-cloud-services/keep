<script lang="ts">
	import type { PageData } from './$types';
	import { formatCentsForInput } from '$lib/contracts';
	let { data }: { data: PageData } = $props();
</script>
<svelte:head><title>Resource Roles — Keep</title></svelte:head>
<div class="pf-topbar"><div><div class="pf-crumb">Admin / Service Desk</div><h1>Resource Roles</h1></div><a class="btn btn-primary" href="/resource-roles/new">New Resource Role</a></div>
<div class="section-card"><div class="section-card-head"><span class="section-card-title">Resource Roles</span><span class="row-count-badge">{data.resourceRoles.length}</span></div>
<table><thead><tr><th>Name</th><th>Default rate</th><th>Status</th></tr></thead><tbody>
{#each data.resourceRoles as item}<tr><td><a href={`/resource-roles/${item.id}`}>{item.name}</a>{#if item.isDefault} <span class="badge badge-info">Default</span>{/if}</td><td>${formatCentsForInput(item.hourlyRateCents)}/hr</td><td><span class="badge" class:badge-success={item.isActive} class:badge-muted={!item.isActive}>{item.isActive ? 'Active' : 'Inactive'}</span></td></tr>
{:else}<tr><td colspan="3" class="empty">No resource roles yet.</td></tr>{/each}
</tbody></table></div>
