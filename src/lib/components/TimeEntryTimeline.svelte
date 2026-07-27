<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	let {
		date = $bindable(),
		startTime = $bindable(),
		endTime = $bindable(),
		endsNextDay = $bindable(),
		timezone,
		entries,
		businessStartMinute = 480,
		businessEndMinute = 1080,
		incrementMinutes = 5
	}: {
		date: string;
		startTime: string;
		endTime: string;
		endsNextDay: boolean;
		timezone: string;
		entries: { startAt: number | null; endAt: number | null }[];
		businessStartMinute?: number;
		businessEndMinute?: number;
		incrementMinutes?: number;
	} = $props();

	let timeline: HTMLDivElement;
	let calendar: HTMLInputElement;
	let dragAnchor = $state<number | null>(null);
	let dragMode = $state<'new' | 'start' | 'end' | null>(null);
	let highlightStart = $state(0);
	let highlightEnd = $state(15);
	let businessStart = $derived(businessStartMinute);
	let businessEnd = $derived(businessEndMinute);
	let viewStart = $derived(businessStart - 15);
	let viewEnd = $derived(businessEnd + 15);
	let viewDuration = $derived(viewEnd - viewStart);
	let ticks = $derived(
		Array.from(
			{ length: Math.max(0, Math.floor(businessEnd / 120) - Math.ceil(businessStart / 120) + 1) },
			(_, index) => (Math.ceil(businessStart / 120) + index) * 120
		)
	);

	function shiftDate(value: string, days: number): string {
		const parsed = new Date(`${value}T00:00:00Z`);
		parsed.setUTCDate(parsed.getUTCDate() + days);
		return parsed.toISOString().slice(0, 10);
	}

	let dayChoices = $derived(Array.from({ length: 6 }, (_, index) => shiftDate(date, index - 5)));

	function label(value: string): { weekday: string; date: string } {
		const parsed = new Date(`${value}T00:00:00Z`);
		return {
			weekday: parsed.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }),
			date: parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
		};
	}

	function minutes(value: string): number {
		const [hour, minute] = value.split(':').map(Number);
		return hour * 60 + minute;
	}

	function timeValue(value: number): string {
		const normalized = Math.max(0, Math.min(1439, value));
		return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
	}

	function minuteAt(clientX: number): number {
		const rect = timeline.getBoundingClientRect();
		return Math.max(
			viewStart,
			Math.min(viewEnd, Math.round((viewStart + ((clientX - rect.left) / rect.width) * viewDuration) / incrementMinutes) * incrementMinutes)
		);
	}

	function updateSelection(current: number) {
		if (dragAnchor == null) return;
		let start: number;
		let end: number;
		if (dragMode === 'start') {
			start = Math.min(current, dragAnchor - incrementMinutes);
			end = dragAnchor;
		} else if (dragMode === 'end') {
			start = dragAnchor;
			end = Math.max(current, dragAnchor + incrementMinutes);
		} else {
			start = Math.min(dragAnchor, current);
			end = Math.max(dragAnchor, current);
		}
		start = Math.max(viewStart, start);
		end = Math.min(viewEnd, end);
		if (end === start) end = Math.min(viewEnd, start + incrementMinutes);
		highlightStart = start;
		highlightEnd = end;
		startTime = timeValue(start);
		if (end >= 1440) {
			endTime = '00:00';
			endsNextDay = true;
		} else {
			endTime = timeValue(end);
			endsNextDay = false;
		}
	}

	function pointerDown(event: PointerEvent) {
		timeline.setPointerCapture(event.pointerId);
		const current = minuteAt(event.clientX);
		const handleTolerance = (12 / timeline.getBoundingClientRect().width) * viewDuration;
		if (Math.abs(current - highlightStart) <= handleTolerance) {
			dragMode = 'start';
			dragAnchor = highlightEnd;
			updateSelection(current);
		} else if (Math.abs(current - highlightEnd) <= handleTolerance) {
			dragMode = 'end';
			dragAnchor = highlightStart;
			updateSelection(current);
		} else {
			dragMode = 'new';
			dragAnchor = Math.min(viewEnd - incrementMinutes, current);
			updateSelection(dragAnchor + incrementMinutes);
		}
	}

	function pointerMove(event: PointerEvent) {
		if (dragAnchor != null) {
			updateSelection(minuteAt(event.clientX));
			return;
		}
		const current = minuteAt(event.clientX);
		const handleTolerance = (12 / timeline.getBoundingClientRect().width) * viewDuration;
		timeline.style.cursor =
			Math.abs(current - highlightStart) <= handleTolerance || Math.abs(current - highlightEnd) <= handleTolerance
				? 'ew-resize'
				: 'crosshair';
	}

	function pointerUp(event: PointerEvent) {
		if (timeline.hasPointerCapture(event.pointerId)) timeline.releasePointerCapture(event.pointerId);
		dragAnchor = null;
		dragMode = null;
	}

	function localPosition(epoch: number): { date: string; minute: number } {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		}).formatToParts(new Date(epoch * 1000));
		const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
		return {
			date: `${part('year')}-${part('month')}-${part('day')}`,
			minute: Number(part('hour')) * 60 + Number(part('minute'))
		};
	}

	let existingBlocks = $derived(
		entries.flatMap((entry) => {
			if (!entry.startAt || !entry.endAt) return [];
			const start = localPosition(entry.startAt);
			const end = localPosition(entry.endAt);
			if (start.date !== date) return [];
			const blockEnd = end.date === date ? end.minute : viewEnd;
			if (blockEnd <= viewStart || start.minute >= viewEnd) return [];
			return [{ start: Math.max(viewStart, start.minute), end: Math.min(viewEnd, blockEnd) }];
		})
	);
	let selectedStart = $derived(minutes(startTime));
	let selectedEnd = $derived(endsNextDay ? 1440 : minutes(endTime));

	$effect(() => {
		const manualStart = minutes(startTime);
		const manualEnd = endsNextDay ? 1440 : minutes(endTime);
		if (dragAnchor == null) {
			highlightStart = manualStart;
			highlightEnd = manualEnd;
		}
	});
</script>

<div class="day-picker">
	{#each dayChoices as choice}
		{@const item = label(choice)}
		<button type="button" class:active={choice === date} onclick={() => (date = choice)}><span>{item.weekday}</span><strong>{item.date}</strong></button>
	{/each}
	<button class="calendar-button" type="button" onclick={() => calendar?.showPicker?.()} aria-label="Choose another date" title="Choose another date">
		<Icon name="calendar" class="calendar-icon" />
	</button>
	<input class="hidden-calendar" bind:this={calendar} type="date" bind:value={date} tabindex="-1" aria-hidden="true" />
</div>

<div
	class="timeline"
	bind:this={timeline}
	role="slider"
	aria-label="Time worked"
	aria-valuemin={viewStart}
	aria-valuemax={viewEnd}
	aria-valuenow={selectedStart}
	tabindex="0"
	onpointerdown={pointerDown}
	onpointermove={pointerMove}
	onpointerup={pointerUp}
	onpointercancel={pointerUp}
>
	<div class="business-hours" style:left={`${((businessStart - viewStart) / viewDuration) * 100}%`} style:width={`${((businessEnd - businessStart) / viewDuration) * 100}%`}></div>
	{#each existingBlocks as block}
		<div class="existing-block" style={`left:${((block.start - viewStart) / viewDuration) * 100}%;width:${((block.end - block.start) / viewDuration) * 100}%`}></div>
	{/each}
	<svg class="selection-layer" viewBox={`${viewStart} 0 ${viewDuration} 54`} preserveAspectRatio="none" aria-hidden="true">
		<rect class="selected-block" x={highlightStart} y="0" width={Math.max(incrementMinutes, highlightEnd - highlightStart)} height="54" />
		<line class="selection-handle" x1={highlightStart} x2={highlightStart} y1="0" y2="54" />
		<line class="selection-handle" x1={highlightEnd} x2={highlightEnd} y1="0" y2="54" />
	</svg>
	{#each ticks as tick}
		<div class="tick" style={`left:${((tick - viewStart) / viewDuration) * 100}%`}><span>{tick / 60}:00</span></div>
	{/each}
</div>
<p class="timeline-help">Drag an edge to adjust Start or End in {incrementMinutes}-minute increments. Drag elsewhere to select a new range. Dark blocks are existing entries.</p>

<style>
	.day-picker { position:relative; display:grid; grid-template-columns:repeat(6, minmax(62px,1fr)) auto; gap:5px; margin-bottom:14px; }
	.day-picker button { display:flex; min-height:48px; flex-direction:column; align-items:center; justify-content:center; border:1px solid var(--color-border); border-radius:var(--r-btn); background:var(--color-canvas); color:var(--color-text-muted); cursor:pointer; }
	.day-picker button:hover, .day-picker button.active { border-color:var(--color-accent); color:var(--color-text-primary); }
	.day-picker button.active { background:color-mix(in srgb, var(--color-accent) 14%, var(--color-canvas)); }
	.day-picker span { font-size:9px; text-transform:uppercase; }
	.day-picker strong { font-size:11px; }
	.calendar-button { width:48px; padding:0; }
	.calendar-button :global(.calendar-icon) { width:18px; height:18px; }
	.hidden-calendar { position:absolute; right:0; bottom:0; width:1px; height:1px; opacity:0; pointer-events:none; }
	.timeline { position:relative; height:54px; overflow:visible; border:1px solid var(--color-border); border-radius:var(--r-btn); background:var(--color-canvas); cursor:crosshair; touch-action:none; user-select:none; }
	.business-hours { position:absolute; z-index:3; top:-5px; bottom:-5px; border-inline:1px dashed var(--color-text-muted); opacity:.75; pointer-events:none; }
	.existing-block { position:absolute; top:22px; height:16px; border-radius:3px; pointer-events:none; }
	.existing-block { background:color-mix(in srgb, var(--color-accent) 24%, var(--color-surface)); border:1px solid color-mix(in srgb, var(--color-accent) 60%, var(--color-border)); opacity:.7; }
	.selection-layer { position:absolute; z-index:2; inset:0; width:100%; height:100%; pointer-events:none; }
	.selected-block { fill:var(--color-success); fill-opacity:.1; stroke:var(--color-success); stroke-opacity:.65; stroke-width:1; vector-effect:non-scaling-stroke; }
	.selection-handle { stroke:var(--color-success); stroke-opacity:.8; stroke-width:2; vector-effect:non-scaling-stroke; }
	.tick { position:absolute; top:0; bottom:0; width:1px; background:color-mix(in srgb, var(--color-border-strong) 70%, transparent); pointer-events:none; }
	.tick span { position:absolute; top:3px; left:4px; color:var(--color-text-subtle); font-size:8px; opacity:.8; }
	.tick:last-child span { left:auto; right:4px; }
	.timeline-help { margin:6px 0 14px; color:var(--color-text-subtle); font-size:9px; }
	@media (max-width:700px) { .day-picker { grid-template-columns:repeat(3,1fr); } .calendar-button { min-height:40px; } }
</style>
