<script lang="ts">
	let {
		data,
		centerLabel
	}: {
		data: { label: string; value: number; color: string }[];
		centerLabel?: string;
	} = $props();

	const size = 110;
	const radius = 45;
	const circumference = 2 * Math.PI * radius;

	let total = $derived(data.reduce((sum, d) => sum + d.value, 0));

	let segments = $derived(
		(() => {
			let offset = 0;
			return data
				.filter((d) => d.value > 0)
				.map((d) => {
					const fraction = total > 0 ? d.value / total : 0;
					const dash = fraction * circumference;
					const seg = { ...d, dash, offset };
					offset += dash;
					return seg;
				});
		})()
	);
</script>

<div class="donut-wrap">
	<div class="donut-svg-wrap">
		<svg class="donut-svg" viewBox="0 0 {size} {size}">
			<circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-border)" stroke-width="12" />
			{#each segments as s (s.label)}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={s.color}
					stroke-width="12"
					stroke-dasharray="{s.dash} {circumference - s.dash}"
					stroke-dashoffset={-s.offset}
					transform="rotate(-90 {size / 2} {size / 2})"
				/>
			{/each}
		</svg>
		<div class="donut-center">
			<div class="donut-center-value">{total}</div>
			{#if centerLabel}<div class="donut-center-label">{centerLabel}</div>{/if}
		</div>
	</div>
	<div class="donut-legend">
		{#each data as d (d.label)}
			<div class="legend-row">
				<span class="legend-dot" style="background: {d.color};"></span>
				<span class="legend-name">{d.label}</span>
				<span class="legend-count">{d.value}</span>
			</div>
		{/each}
	</div>
</div>
