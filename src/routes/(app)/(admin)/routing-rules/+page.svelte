<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let selectedIssueTypeId = $state(untrack(() => data.issueTypes[0]?.id ?? ''));

	let availableSubTypes = $derived(data.subIssueTypes.filter((s) => s.issueTypeId === selectedIssueTypeId));
</script>

<svelte:head>
	<title>Routing Rules — Keep</title>
</svelte:head>

<div class="pf-topbar">
	<h1>Routing Rules</h1>
</div>

{#if form && 'error' in form && form.error}
	<div class="error-banner">{form.error}</div>
{/if}

<div class="section-card">
	<div class="section-card-head">
		<span class="section-card-title">All Rules <span class="row-count-badge">{data.rules.length}</span></span>
	</div>
	<table>
		<thead>
			<tr>
				<th>Issue Type</th>
				<th>Sub-Type</th>
				<th>Target Queue</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each data.rules as r (r.id)}
				<tr>
					<td>{r.issueTypeName}</td>
					<td>{r.subIssueTypeName ?? '(any)'}</td>
					<td>{r.targetQueueName}</td>
					<td style="text-align:right;">
						<form method="POST" action="?/remove" use:enhance>
							<input type="hidden" name="id" value={r.id} />
							<button class="btn btn-danger btn-sm" type="submit">Remove</button>
						</form>
					</td>
				</tr>
			{:else}
				<tr><td colspan="4" class="empty">No routing rules yet — new tickets fall back to the default queue.</td></tr>
			{/each}
		</tbody>
	</table>
	<form method="POST" action="?/create" use:enhance style="padding: 16px 20px; display: flex; gap: 10px; align-items: end; border-top: 1px solid var(--color-border);">
		<div class="field" style="margin-bottom: 0; flex: 1;">
			<label for="issueTypeId">Issue Type</label>
			<select id="issueTypeId" name="issueTypeId" bind:value={selectedIssueTypeId}>
				{#each data.issueTypes as it (it.id)}
					<option value={it.id}>{it.name}</option>
				{/each}
			</select>
		</div>
		<div class="field" style="margin-bottom: 0; flex: 1;">
			<label for="subIssueTypeId">Sub-Type (optional)</label>
			<select id="subIssueTypeId" name="subIssueTypeId">
				<option value="">(any)</option>
				{#each availableSubTypes as st (st.id)}
					<option value={st.id}>{st.name}</option>
				{/each}
			</select>
		</div>
		<div class="field" style="margin-bottom: 0; flex: 1;">
			<label for="targetQueueId">Target Queue</label>
			<select id="targetQueueId" name="targetQueueId">
				{#each data.queues as q (q.id)}
					<option value={q.id}>{q.name}</option>
				{/each}
			</select>
		</div>
		<button class="btn btn-primary" type="submit">Add rule</button>
	</form>
</div>
