<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Companies — Keep</title>
</svelte:head>

<div class="pf-topbar">
	<h1>Companies</h1>
	<a class="btn btn-primary" href="/companies/new">+ New Company</a>
</div>

<div class="section-card">
	<div class="section-card-head">
		<span class="section-card-title">All Companies <span class="row-count-badge">{data.companies.length}</span></span>
	</div>
	<table>
		<thead>
			<tr>
				<th>Name</th>
				<th>Type</th>
				<th>SLA Policy</th>
				<th>Status</th>
			</tr>
		</thead>
		<tbody>
			{#each data.companies as c (c.id)}
				<tr onclick={() => (window.location.href = `/companies/${c.id}`)} style="cursor: pointer;">
					<td>{c.name}</td>
					<td><span class="badge badge-muted">{c.type}</span></td>
					<td>{c.slaPolicyName ?? '—'}</td>
					<td><span class="badge" class:badge-success={c.status === 'active'} class:badge-muted={c.status !== 'active'}>{c.status}</span></td>
				</tr>
			{:else}
				<tr><td colspan="4" class="empty">No companies yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
