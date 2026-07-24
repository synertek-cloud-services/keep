<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedCompanyId = $state(data.companies[0]?.id ?? '');
	let selectedIssueTypeId = $state('');

	let availableContacts = $derived(data.contacts.filter((c) => c.companyId === selectedCompanyId));
	let availableSubTypes = $derived(data.subIssueTypes.filter((s) => s.issueTypeId === selectedIssueTypeId));
</script>

<svelte:head>
	<title>New Ticket — Keep</title>
</svelte:head>

<div class="pf-page">
	<div class="pf-crumb"><a href="/tickets">Tickets</a> / New</div>
	<div class="pf-topbar">
		<h1>New Ticket</h1>
	</div>

	{#if form?.error}
		<div class="error-banner">{form.error}</div>
	{/if}

	<form method="POST" use:enhance class="pf-body">
		<div class="pf-group">
			<div class="field">
				<label for="title">Title</label>
				<input id="title" name="title" type="text" required />
			</div>
			<div class="field">
				<label for="description">Description</label>
				<textarea id="description" name="description" rows="4" style="background: var(--color-canvas); border: 1px solid var(--color-border-strong); border-radius: var(--r-btn); padding: 8px 11px; color: var(--color-text-primary); font-family: var(--font); font-size: 13px; width: 100%;"></textarea>
			</div>
			<div class="field">
				<label for="companyId">Company</label>
				<select id="companyId" name="companyId" bind:value={selectedCompanyId} required>
					{#each data.companies as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="contactId">Contact (optional)</label>
				<select id="contactId" name="contactId">
					<option value="">—</option>
					{#each availableContacts as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="issueTypeId">Issue Type (optional)</label>
				<select id="issueTypeId" name="issueTypeId" bind:value={selectedIssueTypeId}>
					<option value="">—</option>
					{#each data.issueTypes as it (it.id)}
						<option value={it.id}>{it.name}</option>
					{/each}
				</select>
			</div>
			{#if selectedIssueTypeId}
				<div class="field">
					<label for="subIssueTypeId">Sub-Issue Type (optional)</label>
					<select id="subIssueTypeId" name="subIssueTypeId">
						<option value="">—</option>
						{#each availableSubTypes as st (st.id)}
							<option value={st.id}>{st.name}</option>
						{/each}
					</select>
				</div>
			{/if}
			<p style="color: var(--color-text-muted); font-size: 11px; margin-top: 4px;">
				New tickets enter Triage with no priority set. A tech sets the priority when triaging, which starts the response/resolution SLA clocks.
			</p>
			<button class="btn btn-primary" type="submit" style="margin-top: 10px;">Create Ticket</button>
		</div>
	</form>
</div>
