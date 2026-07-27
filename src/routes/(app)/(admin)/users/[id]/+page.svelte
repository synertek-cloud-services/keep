<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	// svelte-ignore state_referenced_locally
	let selectedRoleIds = $state(data.assignedRoles.map((item) => item.resourceRoleId));
	// svelte-ignore state_referenced_locally
	let defaultResourceRoleId = $state(data.assignedRoles.find((item) => item.isDefault)?.resourceRoleId ?? '');
</script>

<svelte:head>
	<title>{data.isNew ? 'New User' : 'Edit User'} — Keep</title>
</svelte:head>

<div class="pf-page">
	<div class="pf-crumb"><a href="/users">Users</a> / {data.isNew ? 'New' : data.editUser?.displayName ?? data.editUser?.email}</div>
	<div class="pf-topbar">
		<h1>{data.isNew ? 'New User' : 'Edit User'}</h1>
		{#if !data.isNew && data.editUser}
			<form method="POST" action="?/setActive" use:enhance>
				<input type="hidden" name="isActive" value={data.editUser.isActive ? '0' : '1'} />
				<button class="btn btn-sm" class:btn-danger={data.editUser.isActive} class:btn-primary={!data.editUser.isActive} type="submit">
					{data.editUser.isActive ? 'Deactivate' : 'Reactivate'}
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
				<label for="email">Email</label>
				<input id="email" name="email" type="email" value={data.editUser?.email ?? ''} required />
			</div>
			<div class="field">
				<label for="displayName">Display name</label>
				<input id="displayName" name="displayName" type="text" value={data.editUser?.displayName ?? ''} />
			</div>
			<div class="field">
				<label for="role">Role</label>
				<select id="role" name="role">
					<option value="tech" selected={data.editUser?.role !== 'admin'}>Tech</option>
					<option value="admin" selected={data.editUser?.role === 'admin'}>Admin</option>
				</select>
			</div>
			<div class="field">
				<label for="password">{data.isNew ? 'Password' : 'New password (leave blank to keep current)'}</label>
				<input id="password" name="password" type="password" autocomplete="new-password" required={data.isNew} />
			</div>
			<div class="field">
				<span class="field-label">Resource roles</span>
				<div class="role-list">{#each data.resourceRoles.filter((item) => item.isActive || selectedRoleIds.includes(item.id)) as item}<label><input type="checkbox" name="resourceRoleIds" value={item.id} checked={selectedRoleIds.includes(item.id)} onchange={(event) => { selectedRoleIds = event.currentTarget.checked ? [...selectedRoleIds, item.id] : selectedRoleIds.filter((id) => id !== item.id); if (!selectedRoleIds.includes(defaultResourceRoleId)) defaultResourceRoleId = selectedRoleIds[0] ?? ''; }} /> {item.name}{item.isActive ? '' : ' (Inactive)'}</label>{/each}</div>
			</div>
			<div class="field"><label for="defaultResourceRoleId">Default resource role</label><select id="defaultResourceRoleId" name="defaultResourceRoleId" bind:value={defaultResourceRoleId}><option value="">First assigned role</option>{#each data.resourceRoles.filter((item) => selectedRoleIds.includes(item.id)) as item}<option value={item.id}>{item.name}</option>{/each}</select></div>
			<button class="btn btn-primary" type="submit">{data.isNew ? 'Create User' : 'Save'}</button>
		</div>
	</form>
</div>
<style>
	.field-label { color:var(--color-text-muted); font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; }
	.role-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
	.role-list label { display:flex; align-items:center; gap:6px; color:var(--color-text-primary); font-size:12px; font-weight:400; text-transform:none; letter-spacing:normal; }
</style>
