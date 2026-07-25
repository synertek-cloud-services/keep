<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="shell">
	<aside class="sidebar">
		<div class="sidebar-brand">
			<div class="sidebar-brand-mark">K</div>
			<span class="sidebar-brand-name">Keep</span>
		</div>

		<Sidebar role={data.user.role} />
	</aside>

	<div class="main-wrap">
		<header class="topbar">
			<div></div>
			<div style="display:flex; align-items:center; gap:12px;">
				<span style="color: var(--color-text-muted); font-size: 12px;">{data.user.displayName ?? data.user.email}</span>
				<form method="POST" action="/logout">
					<button class="btn btn-ghost btn-sm" type="submit">Log out</button>
				</form>
			</div>
		</header>
		<main class="content">
			{@render children()}
		</main>
	</div>
</div>
