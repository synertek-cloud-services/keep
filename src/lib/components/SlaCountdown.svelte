<script lang="ts">
	import { onMount } from 'svelte';
	import { slaState, type SlaStateValue } from '$lib/sla';

	let {
		label,
		startedAt,
		dueAt
	}: {
		label: string;
		startedAt: number | null | undefined;
		dueAt: number | null | undefined;
	} = $props();

	let now = $state(Math.floor(Date.now() / 1000));

	onMount(() => {
		const interval = setInterval(() => {
			now = Math.floor(Date.now() / 1000);
		}, 1000);
		return () => clearInterval(interval);
	});

	let slaStateValue: SlaStateValue = $derived(slaState(now, startedAt, dueAt));

	const badgeClass: Record<SlaStateValue, string> = {
		none: 'badge-muted',
		on_track: 'badge-success',
		at_risk: 'badge-warning',
		breached: 'badge-danger'
	};

	function formatRemaining(seconds: number): string {
		const sign = seconds < 0 ? '-' : '';
		const abs = Math.abs(seconds);
		const h = Math.floor(abs / 3600);
		const m = Math.floor((abs % 3600) / 60);
		if (h > 0) return `${sign}${h}h ${m}m`;
		return `${sign}${m}m`;
	}

	let remainingLabel = $derived(dueAt != null ? formatRemaining(dueAt - now) : null);
</script>

{#if dueAt != null}
	<div class="stat-card" class:c-teal={slaStateValue === 'on_track'} class:c-amber={slaStateValue === 'at_risk'} class:c-red={slaStateValue === 'breached'}>
		<div class="stat-label">{label}</div>
		<div class="stat-value" style="font-size: 18px;">
			{slaStateValue === 'breached' ? 'Breached' : `${remainingLabel} left`}
		</div>
		<span class="badge {badgeClass[slaStateValue]}">{slaStateValue.replace('_', ' ')}</span>
	</div>
{/if}
