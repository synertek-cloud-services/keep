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

<style>
	.donut-wrap { display: flex; align-items: center; gap: 18px; }
	.donut-svg-wrap { position: relative; width: 110px; height: 110px; flex-shrink: 0; }
	.donut-svg { display: block; width: 100%; height: 100%; }
	.donut-center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		pointer-events: none;
	}
	.donut-center-value {
		font-family: var(--mono);
		font-size: 20px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--color-text-primary);
		line-height: 1;
	}
	.donut-center-label {
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-subtle);
		margin-top: 3px;
	}
	.donut-legend { flex: 1; display: flex; flex-direction: column; gap: 7px; min-width: 0; }
	.legend-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--color-text-muted); }
	.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
	.legend-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.legend-count { font-family: var(--mono); font-weight: 600; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }
</style>
