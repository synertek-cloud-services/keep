<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const priorityLabels: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
</script>

<svelte:head>
	<title>{data.isNew ? 'New SLA Policy' : 'Edit SLA Policy'} — Keep</title>
</svelte:head>

<div class="pf-page">
	<div class="pf-crumb"><a href="/sla-policies">SLA Policies</a> / {data.isNew ? 'New' : data.policy?.name}</div>
	<div class="pf-topbar">
		<h1>{data.isNew ? 'New SLA Policy' : 'Edit SLA Policy'}</h1>
	</div>

	{#if form?.error}
		<div class="error-banner">{form.error}</div>
	{/if}

	<form method="POST" action="?/save" use:enhance class="pf-body">
		<div class="pf-group">
			<div class="pf-group-title">Policy</div>
			<div class="field">
				<label for="name">Name</label>
				<input id="name" name="name" type="text" value={data.policy?.name ?? ''} required />
			</div>
			<div class="field">
				<label for="triageMinutes">Triage time (minutes)</label>
				<input id="triageMinutes" name="triageMinutes" type="number" min="0" value={data.policy?.triageMinutes ?? 30} required />
			</div>
		</div>

		<div class="pf-group">
			<div class="pf-group-title">Response &amp; Resolution by Priority</div>
			<table>
				<thead>
					<tr>
						<th>Priority</th>
						<th>Response (minutes)</th>
						<th>Resolution (minutes)</th>
					</tr>
				</thead>
				<tbody>
					{#each data.priorities as p (p.priority)}
						<tr>
							<td>{priorityLabels[p.priority]}</td>
							<td><input name={`response_${p.priority}`} type="number" min="0" value={p.responseMinutes} required style="width: 120px;" /></td>
							<td><input name={`resolution_${p.priority}`} type="number" min="0" value={p.resolutionMinutes} required style="width: 120px;" /></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<button class="btn btn-primary" type="submit">{data.isNew ? 'Create Policy' : 'Save'}</button>
	</form>
</div>
