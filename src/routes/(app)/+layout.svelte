<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	function isActive(path: string): boolean {
		return page.url.pathname === path || page.url.pathname.startsWith(path + '/');
	}
</script>

<div class="shell">
	<aside class="sidebar">
		<div class="sidebar-brand">
			<div class="sidebar-brand-mark">K</div>
			<span class="sidebar-brand-name">Keep</span>
		</div>

		<nav class="sidebar-section">
			<div class="sidebar-section-label">Service Desk</div>
			<a class="nav-item" class:active={isActive('/tickets') && page.url.search === ''} href="/tickets">My Tickets</a>
			<a class="nav-item" class:active={page.url.search.includes('all=1')} href="/tickets?all=1">All Tickets</a>
			<a class="nav-item" class:active={page.url.search.includes('unassigned=1')} href="/tickets?unassigned=1">Unassigned</a>
		</nav>

		<nav class="sidebar-section">
			<div class="sidebar-section-label">Dashboard</div>
			<a class="nav-item" class:active={page.url.pathname === '/'} href="/">Overview</a>
		</nav>

		{#if data.user.role === 'admin'}
			<nav class="sidebar-section">
				<div class="sidebar-section-label">Admin</div>
				<a class="nav-item" class:active={isActive('/users')} href="/users">Users</a>
				<a class="nav-item" class:active={isActive('/companies')} href="/companies">Companies</a>
				<a class="nav-item" class:active={isActive('/queues')} href="/queues">Queues</a>
				<a class="nav-item" class:active={isActive('/sla-policies')} href="/sla-policies">SLA Policies</a>
				<a class="nav-item" class:active={isActive('/issue-types')} href="/issue-types">Issue Types</a>
				<a class="nav-item" class:active={isActive('/routing-rules')} href="/routing-rules">Routing Rules</a>
				<a class="nav-item" class:active={isActive('/sso')} href="/sso">Single Sign-On</a>
				<a class="nav-item" class:active={isActive('/api-keys')} href="/api-keys">API Keys</a>
			</nav>
		{/if}
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
