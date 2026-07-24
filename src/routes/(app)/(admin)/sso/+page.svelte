<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Single Sign-On — Keep</title>
</svelte:head>

<div class="pf-topbar">
	<h1>Single Sign-On</h1>
</div>

{#if form && 'error' in form && form.error}
	<div class="error-banner">{form.error}</div>
{/if}

<div class="section-card">
	<div class="section-card-head">
		<span class="section-card-title">Microsoft Entra ID</span>
		{#if data.provider}
			<form method="POST" action="?/toggleEnabled" use:enhance>
				<input type="hidden" name="providerId" value={data.provider.id} />
				<input type="hidden" name="enabled" value={data.provider.enabled ? '0' : '1'} />
				<button class="btn btn-sm" class:btn-primary={!data.provider.enabled} class:btn-ghost={data.provider.enabled} type="submit">
					{data.provider.enabled ? 'Enabled' : 'Disabled'}
				</button>
			</form>
		{/if}
	</div>
	<div style="padding: 20px;">
		<p style="color: var(--color-text-muted); font-size: 12px; margin-bottom: 16px;">
			Keep authenticates independently against the same Entra tenant/app registration Beacon uses — a user
			whose Entra group is mapped below gets a session in both apps via their own Microsoft login.
			Requires an App Registration with a Web redirect URI of <code>{`{origin}/login/microsoft/callback`}</code>
			and delegated + application <code>GroupMember.Read.All</code> / <code>Group.Read.All</code> permissions.
		</p>
		<form method="POST" action="?/saveProvider" use:enhance>
			<div class="field">
				<label for="name">Display name</label>
				<input id="name" name="name" type="text" value={data.provider?.name ?? 'Microsoft Entra ID'} required />
			</div>
			<div class="field">
				<label for="directoryId">Directory (Tenant) ID</label>
				<input id="directoryId" name="directoryId" type="text" value={data.provider?.directoryId ?? ''} required />
			</div>
			<div class="field">
				<label for="clientId">Application (Client) ID</label>
				<input id="clientId" name="clientId" type="text" value={data.provider?.clientId ?? ''} required />
			</div>
			<div class="field">
				<label for="clientSecret">Client Secret {data.provider ? '(leave blank to keep current)' : ''}</label>
				<input id="clientSecret" name="clientSecret" type="password" autocomplete="off" />
			</div>
			<button class="btn btn-primary" type="submit">{data.provider ? 'Save' : 'Configure'}</button>
		</form>
	</div>
</div>

{#if data.provider}
	<div class="section-card">
		<div class="section-card-head">
			<span class="section-card-title">Group → Role Mappings <span class="row-count-badge">{data.mappings.length}</span></span>
		</div>
		<table>
			<thead>
				<tr>
					<th>Group ID</th>
					<th>Group Name</th>
					<th>Role</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.mappings as m (m.id)}
					<tr>
						<td style="font-family: var(--mono); font-size: 11px;">{m.groupId}</td>
						<td>{m.groupName ?? '—'}</td>
						<td><span class="badge" class:badge-info={m.role === 'admin'} class:badge-muted={m.role === 'tech'}>{m.role}</span></td>
						<td>
							<form method="POST" action="?/deleteMapping" use:enhance>
								<input type="hidden" name="id" value={m.id} />
								<button class="btn btn-danger btn-sm" type="submit">Remove</button>
							</form>
						</td>
					</tr>
				{:else}
					<tr><td colspan="4" class="empty">No group mappings yet — no Microsoft user can log in until at least one exists.</td></tr>
				{/each}
			</tbody>
		</table>
		<form method="POST" action="?/addMapping" use:enhance style="padding: 16px 20px; display: flex; gap: 10px; align-items: end; border-top: 1px solid var(--color-border);">
			<input type="hidden" name="providerId" value={data.provider.id} />
			<div class="field" style="margin-bottom: 0; flex: 1;">
				<label for="groupId">Entra Group Object ID</label>
				<input id="groupId" name="groupId" type="text" required />
			</div>
			<div class="field" style="margin-bottom: 0; flex: 1;">
				<label for="groupName">Friendly name (optional)</label>
				<input id="groupName" name="groupName" type="text" />
			</div>
			<div class="field" style="margin-bottom: 0;">
				<label for="role">Role</label>
				<select id="role" name="role">
					<option value="tech">Tech</option>
					<option value="admin">Admin</option>
				</select>
			</div>
			<button class="btn btn-primary" type="submit">Add mapping</button>
		</form>
	</div>
{/if}
