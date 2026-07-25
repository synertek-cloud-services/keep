<script lang="ts">
	import { page } from '$app/state';
	import {
		NAV_SECTIONS,
		visibleNavSections,
		linkIsActive,
		sectionAllLinks,
		type NavRole,
		type NavSection
	} from '$lib/navigation';
	import Icon from './Icon.svelte';

	let { role }: { role: NavRole } = $props();

	const sections = $derived(visibleNavSections(role));

	function sectionMatchesCurrentRoute(section: NavSection): boolean {
		return sectionAllLinks(section).some((l) => linkIsActive(l, page.url));
	}

	// Computed once at mount from the route active on first render — a full
	// page load opens whichever section contains the current page; every
	// other section starts closed. After that, purely user-driven and
	// independent per section (multiple can be open at once — a flat
	// Record<string, boolean>, not a single-open accordion, matching
	// Beacon's flat `openSections` object). SvelteKit reuses this layout
	// instance across client-side navigations, so this "once" computation
	// naturally persists as intended without needing sessionStorage.
	let openSections = $state<Record<string, boolean>>(
		Object.fromEntries(NAV_SECTIONS.map((s) => [s.id, sectionMatchesCurrentRoute(s)]))
	);

	function toggle(id: string) {
		openSections[id] = !openSections[id];
	}
</script>

<nav class="sidebar-nav">
	{#each sections as section (section.id)}
		<div
			class="sec-head"
			role="button"
			tabindex="0"
			aria-expanded={openSections[section.id]}
			onclick={() => toggle(section.id)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggle(section.id);
				}
			}}
		>
			<Icon name={section.icon} class="sec-icon" />
			<span class="sec-label">{section.label}</span>
			<Icon name="chevron" class="sec-chevron {openSections[section.id] ? 'open' : ''}" />
		</div>
		{#if openSections[section.id]}
			<div class="sec-body">
				{#each section.links ?? [] as link (link.href)}
					<a class="sbi" class:active={linkIsActive(link, page.url)} href={link.href}>{link.label}</a>
				{/each}
				{#each section.groups ?? [] as group (group.label)}
					<div class="sbi-group-label">{group.label}</div>
					{#each group.links as link (link.href)}
						<a class="sbi" class:active={linkIsActive(link, page.url)} href={link.href}>{link.label}</a>
					{/each}
				{/each}
			</div>
		{/if}
	{/each}
</nav>
