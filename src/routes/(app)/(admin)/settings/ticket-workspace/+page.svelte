<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import TicketWorkspaceEditor from '$lib/components/TicketWorkspaceEditor.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Ticket Workspace — Keep</title></svelte:head>

<div class="pf-page">
	<div class="pf-crumb">Admin / Ticket Workspace</div>
	<div class="pf-topbar"><h1>Ticket Workspace</h1></div>

	{#if form?.error}<div class="error-banner">{form.error}</div>{/if}
	{#if form?.success}<div class="success-message">Organization default saved.</div>{/if}

	<div class="pf-group">
		<div class="pf-group-title">Organization Default</div>
		<p class="intro">This layout is used by every technician who has not saved a personal workspace. Existing personal layouts are not overwritten.</p>
		<TicketWorkspaceEditor initial={data.layout} action="?/save" submitLabel="Save Organization Default" />
	</div>
</div>

<style>
	.intro { margin:0 0 16px; max-width:720px; color:var(--color-text-muted); font-size:12px; }
	.success-message { margin-bottom:16px; padding:10px 12px; border:1px solid var(--color-success); border-radius:var(--r-btn); color:var(--color-success); font-size:12px; }
</style>
