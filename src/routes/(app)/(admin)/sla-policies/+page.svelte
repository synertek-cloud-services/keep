<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>SLA Policies — Keep</title>
</svelte:head>

<div class="pf-topbar">
	<h1>SLA Policies</h1>
	<a class="btn btn-primary" href="/sla-policies/new">+ New Policy</a>
</div>

<div class="section-card">
	<div class="section-card-head">
		<span class="section-card-title">All Policies <span class="row-count-badge">{data.policies.length}</span></span>
	</div>
	<table>
		<thead>
			<tr>
				<th>Name</th>
				<th>Triage Time</th>
			</tr>
		</thead>
		<tbody>
			{#each data.policies as p (p.id)}
				<tr onclick={() => (window.location.href = `/sla-policies/${p.id}`)} style="cursor: pointer;">
					<td>{p.name}</td>
					<td>{p.triageMinutes} min</td>
				</tr>
			{:else}
				<tr><td colspan="2" class="empty">No SLA policies yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
