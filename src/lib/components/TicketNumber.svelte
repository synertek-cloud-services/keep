<script lang="ts">
	let {
		value,
		size = 'sm',
		class: className = ''
	}: {
		value: string;
		size?: 'sm' | 'inherit';
		class?: string;
	} = $props();

	const match = $derived(value.match(/^(.*-)([^-]+)$/));
	const prefix = $derived(match?.[1] ?? '');
	const sequence = $derived(match?.[2] ?? value);
</script>

<span class="ticket-number {size} {className}" title={value}>
	<span class="prefix">{prefix}</span><span class="sequence">{sequence}</span>
</span>

<style>
	.ticket-number { font-family:var(--mono); font-variant-numeric:tabular-nums; white-space:nowrap; }
	.ticket-number.sm { font-size:11px; }
	.ticket-number.inherit { font-size:inherit; }
	.prefix { color:var(--color-text-subtle); font-weight:500; }
	.sequence { color:var(--color-text-primary); font-weight:700; }
</style>
