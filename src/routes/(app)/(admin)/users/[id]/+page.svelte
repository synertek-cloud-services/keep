<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
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
			<button class="btn btn-primary" type="submit">{data.isNew ? 'Create User' : 'Save'}</button>
		</div>
	</form>
</div>
