<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import SlaCountdown from '$lib/components/SlaCountdown.svelte';
	import { BILLING_MODEL_LABELS, formatCentsForInput } from '$lib/contracts';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedCompanyId = $state(data.ticket.companyId);
	let selectedIssueTypeId = $state(data.ticket.issueTypeId ?? '');
	let selectedContractId = $state('');
	let availableContacts = $derived(data.contacts.filter((c) => c.companyId === selectedCompanyId));
	let availableSubTypes = $derived(data.subIssueTypes.filter((s) => s.issueTypeId === selectedIssueTypeId));
	let availableContracts = $derived(data.contracts.filter((contract) => contract.companyId === selectedCompanyId));

	$effect(() => {
		selectedContractId = data.ticket.contractId ?? '';
	});

	function changeCompany(companyId: string) {
		selectedCompanyId = companyId;
		const companyContracts = data.contracts.filter((contract) => contract.companyId === companyId);
		selectedContractId = companyContracts.find((contract) => contract.isDefault)?.id ?? '';
	}

	function billingContext(entry: PageData['timeEntries'][number]): string {
		if (!entry.contractBillingModel) return '—';
		const label = BILLING_MODEL_LABELS[entry.contractBillingModel];
		if (entry.contractBillingModel === 'fixed_fee' || entry.contractRateCents == null) return label;
		const rate = `$${formatCentsForInput(entry.contractRateCents)}/hr`;
		return entry.contractBillingModel === 'included_hours' ? `${label} · ${rate} overage` : `${label} · ${rate}`;
	}

	const statusLabels: Record<string, string> = {
		triage: 'Triage',
		new: 'New',
		in_progress: 'In Progress',
		waiting_on_client: 'Waiting on Client',
		waiting_on_vendor: 'Waiting on Vendor',
		resolved: 'Resolved',
		closed: 'Closed'
	};

	const statusActionLabels: Record<string, string> = {
		in_progress: 'Start Work',
		waiting_on_client: 'Wait on Client',
		waiting_on_vendor: 'Wait on Vendor',
		resolved: 'Resolve',
		closed: 'Close'
	};

	let priorityChoice = $state<'critical' | 'high' | 'medium' | 'low' | ''>('');
</script>

<svelte:head>
	<title>{data.ticket.ticketNumber} — Keep</title>
</svelte:head>

<div class="pf-page" style="max-width: 960px;">
	<div class="pf-crumb"><a href="/tickets">Tickets</a> / {data.ticket.ticketNumber}</div>
	<div class="pf-topbar">
		<h1>{data.ticket.ticketNumber} <span class="badge badge-muted" style="margin-left:10px;">{statusLabels[data.ticket.status]}</span>{#if data.ticket.needsTechAttention}<span class="badge badge-warning" style="margin-left:6px;">Needs Attention</span>{/if}</h1>
	</div>

	{#if form?.error}
		<div class="error-banner">{form.error}</div>
	{/if}

	<!-- SLA countdowns -->
	<div class="stat-grid" style="grid-template-columns: repeat(3, 1fr);">
		{#if data.ticket.status === 'triage'}
			<SlaCountdown label="Triage due" startedAt={data.ticket.createdAt} dueAt={data.ticket.triageDueAt} />
		{:else}
			<SlaCountdown label="Response due" startedAt={data.ticket.slaClockStartedAt} dueAt={data.ticket.responseDueAt} />
			<SlaCountdown label="Resolution due" startedAt={data.ticket.slaClockStartedAt} dueAt={data.ticket.resolutionDueAt} />
		{/if}
	</div>

	<!-- Triage-exit gate -->
	{#if data.ticket.status === 'triage'}
		<div class="pf-group" style="border-left: 3px solid var(--color-warning);">
			<div class="pf-group-title">Leave Triage</div>
			<p style="font-size:12px; color: var(--color-text-muted); margin-bottom: 10px;">A priority must be set before this ticket can leave Triage.</p>
			<form method="POST" action="?/triage" use:enhance style="display:flex; gap:10px; align-items:end;">
				<div class="field" style="margin-bottom:0;">
					<label for="priority">Priority</label>
					<select id="priority" name="priority" bind:value={priorityChoice}>
						<option value="">Select…</option>
						<option value="critical">Critical</option>
						<option value="high">High</option>
						<option value="medium">Medium</option>
						<option value="low">Low</option>
					</select>
				</div>
				<button class="btn btn-primary" type="submit" disabled={!priorityChoice}>Leave Triage</button>
			</form>
		</div>
	{:else}
		<!-- Status actions -->
		<div style="display:flex; gap:8px; margin-bottom: 16px; flex-wrap: wrap;">
			{#each data.nextStatuses as s (s)}
				<form method="POST" action="?/setStatus" use:enhance style="display:inline;">
					<input type="hidden" name="status" value={s} />
					<button class="btn btn-ghost btn-sm" type="submit">{statusActionLabels[s] ?? s}</button>
				</form>
			{/each}
			<form method="POST" action="?/clientReply" use:enhance style="display:inline;">
				<button class="btn btn-ghost btn-sm" type="submit">Client Replied</button>
			</form>
		</div>
	{/if}

	<!-- Header -->
	<form method="POST" action="?/updateHeader" use:enhance class="pf-group">
		<div class="pf-group-title">Details</div>
		<div class="field">
			<label for="title">Title</label>
			<input id="title" name="title" type="text" value={data.ticket.title} required />
		</div>
		<div class="field">
			<label for="description">Description</label>
			<textarea id="description" name="description" rows="4" style="background: var(--color-canvas); border: 1px solid var(--color-border-strong); border-radius: var(--r-btn); padding: 8px 11px; color: var(--color-text-primary); font-family: var(--font); font-size: 13px; width: 100%;">{data.ticket.description ?? ''}</textarea>
		</div>
		<div style="display:flex; gap:14px;">
			<div class="field" style="flex:1;">
				<label for="companyId">Company</label>
				<select id="companyId" name="companyId" value={selectedCompanyId} onchange={(e) => changeCompany((e.currentTarget as HTMLSelectElement).value)}>
					{#each data.companies as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
			</div>
			<div class="field" style="flex:1;">
				<label for="contactId">Contact</label>
				<select id="contactId" name="contactId">
					<option value="">—</option>
					{#each availableContacts as c (c.id)}
						<option value={c.id} selected={c.id === data.ticket.contactId}>{c.name}</option>
					{/each}
				</select>
			</div>
		</div>
		<div class="field">
			<label for="contractId">Contract</label>
			<select id="contractId" name="contractId" bind:value={selectedContractId}>
				<option value="">No contract</option>
				{#each availableContracts as contract (contract.id)}
					<option value={contract.id}>
						{contract.name}{contract.isDefault ? ' (Default)' : ''}{contract.status !== 'active' ? ` (${contract.status})` : ''}
					</option>
				{/each}
			</select>
			<div style="font-size:11px; color:var(--color-text-muted); margin-top:4px;">
				Only active, in-term contracts for the selected company are available. The current contract remains visible if it later expires.
			</div>
		</div>
		<div style="display:flex; gap:14px;">
			<div class="field" style="flex:1;">
				<label for="issueTypeId">Issue Type</label>
				<select id="issueTypeId" name="issueTypeId" bind:value={selectedIssueTypeId}>
					<option value="">—</option>
					{#each data.issueTypes as it (it.id)}
						<option value={it.id}>{it.name}</option>
					{/each}
				</select>
			</div>
			<div class="field" style="flex:1;">
				<label for="subIssueTypeId">Sub-Issue Type</label>
				<select id="subIssueTypeId" name="subIssueTypeId">
					<option value="">—</option>
					{#each availableSubTypes as st (st.id)}
						<option value={st.id} selected={st.id === data.ticket.subIssueTypeId}>{st.name}</option>
					{/each}
				</select>
			</div>
		</div>
		<div style="display:flex; gap:14px; align-items:center; font-size:12px; color: var(--color-text-muted);">
			<div>Queue: <strong style="color: var(--color-text-primary);">{data.queue?.name}</strong> (auto-routed by issue type; save to re-route)</div>
		</div>
		<button class="btn btn-primary" type="submit" style="margin-top: 10px;">Save</button>
	</form>

	<!-- Assignment -->
	<div class="pf-group">
		<div class="pf-group-title">Assignment</div>
		<div style="display:flex; gap:10px; align-items:end;">
			<form method="POST" action="?/assign" use:enhance style="display:flex; gap:10px; align-items:end; flex:1;">
				<div class="field" style="margin-bottom:0; flex:1;">
					<label for="resourceId">Assigned to</label>
					<select id="resourceId" name="resourceId">
						<option value="">Unassigned</option>
						{#each data.users as u (u.id)}
							<option value={u.id} selected={u.id === data.ticket.assignedResourceId}>{u.displayName ?? u.email}</option>
						{/each}
					</select>
				</div>
				<button class="btn btn-ghost btn-sm" type="submit">Save</button>
			</form>
			<form method="POST" action="?/selfAssign" use:enhance>
				<button class="btn btn-primary btn-sm" type="submit">Assign to me</button>
			</form>
		</div>
	</div>

	<!-- Notes -->
	<div class="section-card">
		<div class="section-card-head">
			<span class="section-card-title">Notes <span class="row-count-badge">{data.notes.length}</span></span>
		</div>
		<div style="padding: 4px 20px;">
			{#each data.notes as n (n.id)}
				<div style="padding: 12px 0; border-bottom: 1px solid var(--color-border);">
					<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
						<strong style="font-size:12px;">{n.resourceName ?? n.resourceEmail}</strong>
						<span class="badge" class:badge-info={n.visibility === 'client_visible'} class:badge-muted={n.visibility === 'internal'}>
							{n.visibility === 'client_visible' ? 'Client-Visible' : 'Internal'}
						</span>
						<span style="color: var(--color-text-subtle); font-size:11px;">{new Date(n.createdAt * 1000).toLocaleString()}</span>
					</div>
					<div style="font-size:13px; white-space: pre-wrap;">{n.body}</div>
				</div>
			{:else}
				<div class="empty">No notes yet.</div>
			{/each}
		</div>
		<form method="POST" action="?/addNote" use:enhance style="padding: 16px 20px; border-top: 1px solid var(--color-border);">
			<div class="field">
				<label for="body">Add a note</label>
				<textarea id="body" name="body" rows="3" required style="background: var(--color-canvas); border: 1px solid var(--color-border-strong); border-radius: var(--r-btn); padding: 8px 11px; color: var(--color-text-primary); font-family: var(--font); font-size: 13px; width: 100%;"></textarea>
			</div>
			<div style="display:flex; gap:10px; align-items:center;">
				<select name="visibility" style="width: auto;">
					<option value="internal">Internal</option>
					<option value="client_visible">Client-Visible</option>
				</select>
				<button class="btn btn-primary btn-sm" type="submit">Add Note</button>
			</div>
		</form>
	</div>

	<!-- Time entries -->
	<div class="section-card">
		<div class="section-card-head">
			<span class="section-card-title">Time Entries <span class="row-count-badge">{data.timeEntries.length}</span></span>
		</div>
		<table>
			<thead>
				<tr>
					<th>Date</th>
					<th>Tech</th>
					<th>Duration</th>
					<th>Notes</th>
					<th>Contract</th>
					<th>Billing Context</th>
					<th>Billable</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.timeEntries as e (e.id)}
					<tr>
						<td>{new Date(e.workDate * 1000).toLocaleDateString(undefined, { timeZone: 'UTC' })}</td>
						<td>{e.resourceName ?? e.resourceEmail}</td>
						<td>{e.durationMinutes} min</td>
						<td>{e.notes ?? '—'}</td>
						<td>{e.contractName ?? 'No contract'}</td>
						<td>{billingContext(e)}</td>
						<td><span class="badge" class:badge-success={e.billable} class:badge-muted={!e.billable}>{e.billable ? 'Billable' : 'Non-billable'}</span></td>
						<td>
							<form method="POST" action="?/deleteTimeEntry" use:enhance>
								<input type="hidden" name="entryId" value={e.id} />
								<button class="btn btn-danger btn-sm" type="submit">Delete</button>
							</form>
						</td>
					</tr>
				{:else}
					<tr><td colspan="8" class="empty">No time entries yet.</td></tr>
				{/each}
			</tbody>
		</table>
		<form method="POST" action="?/addTimeEntry" use:enhance style="padding: 16px 20px; display:flex; gap:10px; align-items:end; flex-wrap: wrap; border-top: 1px solid var(--color-border);">
			<div class="field" style="margin-bottom:0;">
				<label for="workDate">Date</label>
				<input id="workDate" name="workDate" type="date" value={new Date().toISOString().slice(0, 10)} required />
			</div>
			<div class="field" style="margin-bottom:0;">
				<label for="durationMinutes">Duration (min)</label>
				<input id="durationMinutes" name="durationMinutes" type="number" min="1" required style="width:100px;" />
			</div>
			<div class="field" style="margin-bottom:0; flex:1;">
				<label for="teNotes">Notes</label>
				<input id="teNotes" name="notes" type="text" />
			</div>
			<label style="display:flex; align-items:center; gap:6px; font-size:12px; color: var(--color-text-muted); padding-bottom: 8px;">
				<input type="checkbox" name="billable" checked={data.company?.defaultBillable ?? true} /> Billable
			</label>
			<button class="btn btn-primary btn-sm" type="submit">Log Time</button>
		</form>
	</div>
</div>
