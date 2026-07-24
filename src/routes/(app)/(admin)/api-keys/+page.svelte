<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let selectedIssueTypeId = $state('');
	let availableSubTypes = $derived(data.subIssueTypes.filter((s) => s.issueTypeId === selectedIssueTypeId));

	let copied = $state(false);
	function copyKey(key: string) {
		navigator.clipboard.writeText(key);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<svelte:head>
	<title>API Keys — Keep</title>
</svelte:head>

<div class="pf-topbar">
	<h1>API Keys</h1>
</div>

<p style="color: var(--color-text-muted); font-size: 12px; margin-bottom: 16px;">
	API keys authenticate external systems (starting with Beacon) calling <code>POST /api/tickets/ingest</code> to create
	tickets directly. Distinct from user logins — a revoked key stops working immediately.
</p>

{#if form && 'error' in form && form.error}
	<div class="error-banner">{form.error}</div>
{/if}

{#if form && 'rawKey' in form && form.rawKey}
	<div class="section-card" style="border: 1px solid var(--color-warning);">
		<div class="section-card-head">
			<span class="section-card-title">New key for "{form.keyName}" — copy it now</span>
		</div>
		<div style="padding: 20px;">
			<p style="color: var(--color-warning); font-size: 12px; margin-bottom: 10px;">
				This is the only time this key will be shown. Only its hash is stored.
			</p>
			<div style="display:flex; gap:10px; align-items:center;">
				<code style="background: var(--color-canvas); border: 1px solid var(--color-border-strong); border-radius: var(--r-btn); padding: 8px 11px; flex:1; font-size:12px; word-break: break-all;">{form.rawKey}</code>
				<button class="btn btn-primary btn-sm" type="button" onclick={() => copyKey(form.rawKey as string)}>{copied ? 'Copied!' : 'Copy'}</button>
			</div>
		</div>
	</div>
{/if}

<div class="section-card">
	<div class="section-card-head">
		<span class="section-card-title">All Keys <span class="row-count-badge">{data.keys.length}</span></span>
	</div>
	<table>
		<thead>
			<tr>
				<th>Name</th>
				<th>Default Issue Type</th>
				<th>Created</th>
				<th>Last Used</th>
				<th>Status</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each data.keys as k (k.id)}
				<tr>
					<td>{k.name}</td>
					<td>{k.defaultIssueTypeName ?? '—'}{k.defaultSubIssueTypeName ? ` / ${k.defaultSubIssueTypeName}` : ''}</td>
					<td>{new Date(k.createdAt * 1000).toLocaleDateString()}</td>
					<td>{k.lastUsedAt ? new Date(k.lastUsedAt * 1000).toLocaleString() : 'Never'}</td>
					<td><span class="badge" class:badge-success={!k.revokedAt} class:badge-danger={!!k.revokedAt}>{k.revokedAt ? 'Revoked' : 'Active'}</span></td>
					<td>
						{#if !k.revokedAt}
							<form method="POST" action="?/revoke" use:enhance>
								<input type="hidden" name="id" value={k.id} />
								<button class="btn btn-danger btn-sm" type="submit">Revoke</button>
							</form>
						{/if}
					</td>
				</tr>
			{:else}
				<tr><td colspan="6" class="empty">No API keys yet.</td></tr>
			{/each}
		</tbody>
	</table>
	<form method="POST" action="?/create" use:enhance style="padding: 16px 20px; display: flex; gap: 10px; align-items: end; flex-wrap: wrap; border-top: 1px solid var(--color-border);">
		<div class="field" style="margin-bottom: 0; flex: 1;">
			<label for="name">Name (source)</label>
			<input id="name" name="name" type="text" placeholder="e.g. Beacon" required />
		</div>
		<div class="field" style="margin-bottom: 0; flex: 1;">
			<label for="defaultIssueTypeId">Default issue type (optional)</label>
			<select id="defaultIssueTypeId" name="defaultIssueTypeId" bind:value={selectedIssueTypeId}>
				<option value="">—</option>
				{#each data.issueTypes as it (it.id)}
					<option value={it.id}>{it.name}</option>
				{/each}
			</select>
		</div>
		{#if selectedIssueTypeId}
			<div class="field" style="margin-bottom: 0; flex: 1;">
				<label for="defaultSubIssueTypeId">Default sub-type (optional)</label>
				<select id="defaultSubIssueTypeId" name="defaultSubIssueTypeId">
					<option value="">—</option>
					{#each availableSubTypes as st (st.id)}
						<option value={st.id}>{st.name}</option>
					{/each}
				</select>
			</div>
		{/if}
		<button class="btn btn-primary" type="submit">Create key</button>
	</form>
</div>
