<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	function closeWorkspace() {
		window.close();
	}
</script>

<div class="workspace-shell">
	<header class="workspace-topbar">
		<a class="workspace-brand" href="/tickets" target="_blank">
			<span class="workspace-brand-mark">K</span>
			<span>Keep Ticket Workspace</span>
		</a>
		<div class="workspace-actions">
			<span class="workspace-user">{data.user.displayName ?? data.user.email}</span>
			<a class="btn btn-ghost btn-sm" href="/tickets" target="_blank">Back to Tickets</a>
			<button class="btn btn-ghost btn-sm" type="button" onclick={closeWorkspace}>Close</button>
		</div>
	</header>
	<main class="workspace-content">
		{@render children()}
	</main>
</div>

<style>
	.workspace-shell { min-height:100vh; background:var(--color-canvas); }
	.workspace-topbar { position:sticky; top:0; z-index:50; display:flex; min-height:52px; align-items:center; justify-content:space-between; gap:16px; padding:8px 20px; border-bottom:1px solid var(--color-border); background:var(--color-surface); }
	.workspace-brand { display:flex; align-items:center; gap:9px; color:var(--color-text-primary); font-size:13px; font-weight:700; text-decoration:none; }
	.workspace-brand-mark { display:grid; width:28px; height:28px; place-items:center; border-radius:7px; background:var(--color-accent); color:white; font-size:15px; }
	.workspace-actions { display:flex; align-items:center; gap:8px; }
	.workspace-user { color:var(--color-text-muted); font-size:11px; }
	.workspace-content { padding:20px; }
	@media (max-width:650px) {
		.workspace-topbar { align-items:flex-start; padding:8px 12px; }
		.workspace-brand span:last-child, .workspace-user { display:none; }
		.workspace-content { padding:12px; }
	}
</style>
