<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let editingId = $state<string | null>(null);
</script>

<svelte:head>
	<title>Queues — Keep</title>
</svelte:head>

<div class="pf-topbar">
	<h1>Queues</h1>
</div>

{#if form && 'error' in form && form.error}
	<div class="error-banner">{form.error}</div>
{/if}

<div class="section-card">
	<div class="section-card-head">
		<span class="section-card-title">All Queues <span class="row-count-badge">{data.queues.length}</span></span>
	</div>
	<table>
		<thead>
			<tr>
				<th>Name</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each data.queues as q (q.id)}
				<tr>
					<td>
						{#if editingId === q.id}
							<form method="POST" action="?/rename" use:enhance={() => { return async ({ update }) => { editingId = null; await update(); }; }} style="display:flex; gap:8px;">
								<input type="hidden" name="id" value={q.id} />
								<input name="name" type="text" value={q.name} style="background: var(--color-canvas); border: 1px solid var(--color-border-strong); border-radius: var(--r-btn); padding: 4px 8px; color: var(--color-text-primary);" />
								<button class="btn btn-primary btn-sm" type="submit">Save</button>
								<button class="btn btn-ghost btn-sm" type="button" onclick={() => (editingId = null)}>Cancel</button>
							</form>
						{:else}
							{q.name}
						{/if}
					</td>
					<td style="text-align:right;">
						{#if editingId !== q.id}
							<button class="btn btn-ghost btn-sm" type="button" onclick={() => (editingId = q.id)}>Rename</button>
							<form method="POST" action="?/remove" use:enhance style="display:inline;">
								<input type="hidden" name="id" value={q.id} />
								<button class="btn btn-danger btn-sm" type="submit">Delete</button>
							</form>
						{/if}
					</td>
				</tr>
			{:else}
				<tr><td colspan="2" class="empty">No queues yet.</td></tr>
			{/each}
		</tbody>
	</table>
	<form method="POST" action="?/create" use:enhance style="padding: 16px 20px; display: flex; gap: 10px; align-items: end; border-top: 1px solid var(--color-border);">
		<div class="field" style="margin-bottom: 0; flex: 1;">
			<label for="name">New queue name</label>
			<input id="name" name="name" type="text" required />
		</div>
		<button class="btn btn-primary" type="submit">Add queue</button>
	</form>
</div>
