<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let expanded = $state<Record<string, boolean>>({});

	function subTypesFor(issueTypeId: string) {
		return data.subIssueTypes.filter((s) => s.issueTypeId === issueTypeId);
	}
</script>

<svelte:head>
	<title>Issue Types — Keep</title>
</svelte:head>

<div class="pf-topbar">
	<h1>Issue Types</h1>
</div>

{#if form && 'error' in form && form.error}
	<div class="error-banner">{form.error}</div>
{/if}

<div class="section-card">
	<div class="section-card-head">
		<span class="section-card-title">All Issue Types <span class="row-count-badge">{data.issueTypes.length}</span></span>
	</div>
	{#each data.issueTypes as it (it.id)}
		<div style="border-bottom: 1px solid var(--color-border);">
			<div style="display:flex; align-items:center; justify-content:space-between; padding: 11px 16px;">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => (expanded[it.id] = !expanded[it.id])}
				>
					{expanded[it.id] ? '▾' : '▸'} {it.name}
					<span class="row-count-badge">{subTypesFor(it.id).length}</span>
				</button>
				<form method="POST" action="?/deleteIssueType" use:enhance>
					<input type="hidden" name="id" value={it.id} />
					<button class="btn btn-danger btn-sm" type="submit">Delete</button>
				</form>
			</div>
			{#if expanded[it.id]}
				<div style="padding: 0 16px 16px 40px;">
					<table>
						<tbody>
							{#each subTypesFor(it.id) as st (st.id)}
								<tr>
									<td>{st.name}</td>
									<td style="text-align:right;">
										<form method="POST" action="?/deleteSubType" use:enhance style="display:inline;">
											<input type="hidden" name="id" value={st.id} />
											<button class="btn btn-danger btn-sm" type="submit">Delete</button>
										</form>
									</td>
								</tr>
							{:else}
								<tr><td class="empty">No sub-types yet.</td></tr>
							{/each}
						</tbody>
					</table>
					<form method="POST" action="?/createSubType" use:enhance style="display:flex; gap:8px; margin-top: 10px;">
						<input type="hidden" name="issueTypeId" value={it.id} />
						<input name="name" type="text" placeholder="New sub-type name" required style="background: var(--color-canvas); border: 1px solid var(--color-border-strong); border-radius: var(--r-btn); padding: 6px 10px; color: var(--color-text-primary); flex:1;" />
						<button class="btn btn-primary btn-sm" type="submit">Add sub-type</button>
					</form>
				</div>
			{/if}
		</div>
	{:else}
		<div class="empty">No issue types yet.</div>
	{/each}
	<form method="POST" action="?/createIssueType" use:enhance style="padding: 16px 20px; display: flex; gap: 10px; align-items: end;">
		<div class="field" style="margin-bottom: 0; flex: 1;">
			<label for="name">New issue type name</label>
			<input id="name" name="name" type="text" required />
		</div>
		<button class="btn btn-primary" type="submit">Add issue type</button>
	</form>
</div>
