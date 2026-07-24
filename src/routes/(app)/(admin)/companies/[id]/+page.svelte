<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>{data.isNew ? 'New Company' : 'Edit Company'} — Keep</title>
</svelte:head>

<div class="pf-page">
	<div class="pf-crumb"><a href="/companies">Companies</a> / {data.isNew ? 'New' : data.editCompany?.name}</div>
	<div class="pf-topbar">
		<h1>{data.isNew ? 'New Company' : 'Edit Company'}</h1>
		{#if !data.isNew && data.editCompany}
			<form method="POST" action="?/setStatus" use:enhance>
				<input type="hidden" name="status" value={data.editCompany.status === 'active' ? 'inactive' : 'active'} />
				<button class="btn btn-sm" class:btn-danger={data.editCompany.status === 'active'} class:btn-primary={data.editCompany.status !== 'active'} type="submit">
					{data.editCompany.status === 'active' ? 'Mark Inactive' : 'Mark Active'}
				</button>
			</form>
		{/if}
	</div>

	{#if form?.error}
		<div class="error-banner">{form.error}</div>
	{/if}

	<form method="POST" action="?/save" use:enhance class="pf-body">
		<div class="pf-group">
			<div class="pf-group-title">Details</div>
			<div class="field">
				<label for="name">Company name</label>
				<input id="name" name="name" type="text" value={data.editCompany?.name ?? ''} required />
			</div>
			<div class="field">
				<label for="type">Type</label>
				<select id="type" name="type">
					<option value="client" selected={data.editCompany?.type !== 'internal'}>Client</option>
					<option value="internal" selected={data.editCompany?.type === 'internal'}>Internal</option>
				</select>
			</div>
			<div class="field">
				<label for="slaPolicyId">SLA Policy</label>
				<select id="slaPolicyId" name="slaPolicyId">
					{#each data.slaPolicies as p (p.id)}
						<option value={p.id} selected={(data.editCompany?.slaPolicyId ?? 'sla-standard') === p.id}>{p.name}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="externalRef">External reference (optional)</label>
				<input id="externalRef" name="externalRef" type="text" value={data.editCompany?.externalRef ?? ''} placeholder="e.g. Beacon tenant ID, for ticket-ingestion lookups" />
			</div>
			<label style="display:flex; align-items:center; gap:8px; font-size:12px; color: var(--color-text-muted); margin-bottom: 4px;">
				<input type="checkbox" name="defaultBillable" checked={data.editCompany?.defaultBillable ?? true} />
				Time entries default to billable for this company
			</label>
			<button class="btn btn-primary" type="submit" style="margin-top: 10px;">{data.isNew ? 'Create Company' : 'Save'}</button>
		</div>
	</form>

	{#if !data.isNew}
		<div class="section-card">
			<div class="section-card-head">
				<span class="section-card-title">Contacts <span class="row-count-badge">{data.contacts.length}</span></span>
			</div>
			<table>
				<thead>
					<tr>
						<th>Name</th>
						<th>Email</th>
						<th>Phone</th>
						<th>Primary</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each data.contacts as c (c.id)}
						<tr>
							<td>{c.name}</td>
							<td>{c.email ?? '—'}</td>
							<td>{c.phone ?? '—'}</td>
							<td>{c.isPrimary ? 'Yes' : ''}</td>
							<td>
								<form method="POST" action="?/deleteContact" use:enhance>
									<input type="hidden" name="contactId" value={c.id} />
									<button class="btn btn-danger btn-sm" type="submit">Remove</button>
								</form>
							</td>
						</tr>
					{:else}
						<tr><td colspan="5" class="empty">No contacts yet.</td></tr>
					{/each}
				</tbody>
			</table>
			<form method="POST" action="?/addContact" use:enhance style="padding: 16px 20px; display: flex; gap: 10px; align-items: end; border-top: 1px solid var(--color-border);">
				<div class="field" style="margin-bottom: 0; flex: 1;">
					<label for="cname">Name</label>
					<input id="cname" name="name" type="text" required />
				</div>
				<div class="field" style="margin-bottom: 0; flex: 1;">
					<label for="cemail">Email</label>
					<input id="cemail" name="email" type="email" />
				</div>
				<div class="field" style="margin-bottom: 0; flex: 1;">
					<label for="cphone">Phone</label>
					<input id="cphone" name="phone" type="text" />
				</div>
				<label style="display:flex; align-items:center; gap:6px; font-size:12px; color: var(--color-text-muted); padding-bottom: 8px;">
					<input type="checkbox" name="isPrimary" /> Primary
				</label>
				<button class="btn btn-primary" type="submit">Add contact</button>
			</form>
		</div>
	{/if}
</div>
