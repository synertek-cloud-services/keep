<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Users — Keep</title>
</svelte:head>

<div class="pf-topbar">
	<h1>Users</h1>
	<a class="btn btn-primary" href="/users/new">+ New User</a>
</div>

<div class="section-card">
	<div class="section-card-head">
		<span class="section-card-title">All Users <span class="row-count-badge">{data.users.length}</span></span>
	</div>
	<table>
		<thead>
			<tr>
				<th>Name</th>
				<th>Email</th>
				<th>Role</th>
				<th>Status</th>
			</tr>
		</thead>
		<tbody>
			{#each data.users as u (u.id)}
				<tr onclick={() => (window.location.href = `/users/${u.id}`)} style="cursor: pointer;">
					<td>{u.displayName ?? '—'}</td>
					<td>{u.email}</td>
					<td><span class="badge" class:badge-info={u.role === 'admin'} class:badge-muted={u.role === 'tech'}>{u.role}</span></td>
					<td><span class="badge" class:badge-success={u.isActive} class:badge-danger={!u.isActive}>{u.isActive ? 'active' : 'inactive'}</span></td>
				</tr>
			{:else}
				<tr><td colspan="4" class="empty">No users yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
