<script lang="ts">
	import {
		TICKET_WORKSPACE_PRESETS,
		TICKET_WORKSPACE_WIDGETS,
		type TicketWorkspaceColumn,
		type TicketWorkspaceLayout,
		type TicketWorkspacePreset,
		type TicketWorkspaceWidgetId
	} from '$lib/ticketWorkspace';

	let {
		initial,
		action,
		submitLabel = 'Save Layout'
	}: { initial: TicketWorkspaceLayout; action: string; submitLabel?: string } = $props();

	// svelte-ignore state_referenced_locally
	let layout = $state<TicketWorkspaceLayout>(structuredClone(initial));
	let dragged = $state<TicketWorkspaceWidgetId | null>(null);
	const columns: TicketWorkspaceColumn[] = ['left', 'center', 'right'];
	const titles: Record<TicketWorkspaceColumn, string> = { left: 'Left', center: 'Center', right: 'Right' };
	const widgetTitle = (id: TicketWorkspaceWidgetId) =>
		TICKET_WORKSPACE_WIDGETS.find((widget) => widget.id === id)?.title ?? id;

	function remove(id: TicketWorkspaceWidgetId) {
		for (const column of columns) layout.columns[column] = layout.columns[column].filter((item) => item !== id);
		layout.hidden = layout.hidden.filter((item) => item !== id);
	}

	function move(id: TicketWorkspaceWidgetId, column: TicketWorkspaceColumn, index?: number) {
		remove(id);
		const target = layout.columns[column];
		target.splice(index ?? target.length, 0, id);
	}

	function dropOn(id: TicketWorkspaceWidgetId, column: TicketWorkspaceColumn, index: number) {
		if (!dragged || dragged === id) return;
		move(dragged, column, index);
		dragged = null;
	}

	function shift(id: TicketWorkspaceWidgetId, column: TicketWorkspaceColumn, delta: number) {
		const index = layout.columns[column].indexOf(id);
		const next = Math.max(0, Math.min(layout.columns[column].length - 1, index + delta));
		if (next === index) return;
		layout.columns[column].splice(index, 1);
		layout.columns[column].splice(next, 0, id);
	}

	function hide(id: TicketWorkspaceWidgetId) {
		remove(id);
		layout.hidden.push(id);
	}

	function show(id: TicketWorkspaceWidgetId) {
		layout.hidden = layout.hidden.filter((item) => item !== id);
		layout.columns.center.push(id);
	}
</script>

<form method="POST" {action} class="workspace-editor">
	<div class="field preset-field">
		<label for="workspacePreset">Column widths</label>
		<select id="workspacePreset" value={layout.preset} onchange={(event) => (layout.preset = (event.currentTarget as HTMLSelectElement).value as TicketWorkspacePreset)}>
			{#each Object.entries(TICKET_WORKSPACE_PRESETS) as [value, label]}
				<option {value}>{label}</option>
			{/each}
		</select>
	</div>

	<p class="editor-help">Drag widgets between columns or use the controls. The center column is the primary work area.</p>

	<div class="editor-columns">
		{#each columns as column}
			<section class="editor-column" role="list" ondragover={(event) => event.preventDefault()} ondrop={() => dragged && move(dragged, column)}>
				<h3>{titles[column]} column</h3>
				{#each layout.columns[column] as id, index (id)}
					<div
						class="editor-widget"
						role="listitem"
						draggable="true"
						ondragstart={() => (dragged = id)}
						ondragend={() => (dragged = null)}
						ondragover={(event) => event.preventDefault()}
						ondrop={(event) => {
							event.stopPropagation();
							dropOn(id, column, index);
						}}
					>
						<span class="drag-handle" aria-hidden="true">⋮⋮</span>
						<strong>{widgetTitle(id)}</strong>
						<div class="widget-controls">
							<button type="button" class="mini" onclick={() => shift(id, column, -1)} aria-label="Move up">↑</button>
							<button type="button" class="mini" onclick={() => shift(id, column, 1)} aria-label="Move down">↓</button>
							<select aria-label="Move to column" value={column} onchange={(event) => move(id, (event.currentTarget as HTMLSelectElement).value as TicketWorkspaceColumn)}>
								{#each columns as destination}<option value={destination}>{titles[destination]}</option>{/each}
							</select>
							{#if TICKET_WORKSPACE_WIDGETS.find((widget) => widget.id === id)?.optional}
								<button type="button" class="mini" onclick={() => hide(id)} aria-label="Hide widget">×</button>
							{/if}
						</div>
					</div>
				{:else}
					<div class="drop-target">Drop widgets here</div>
				{/each}
			</section>
		{/each}
	</div>

	{#if layout.hidden.length}
		<div class="hidden-widgets">
			<strong>Hidden widgets</strong>
			{#each layout.hidden as id (id)}
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => show(id)}>+ {widgetTitle(id)}</button>
			{/each}
		</div>
	{/if}

	<input type="hidden" name="layout" value={JSON.stringify(layout)} />
	<button class="btn btn-primary" type="submit">{submitLabel}</button>
</form>

<style>
	.workspace-editor { display:flex; flex-direction:column; gap:14px; }
	.preset-field { max-width:340px; margin:0; }
	.editor-help { margin:0; color:var(--color-text-muted); font-size:12px; }
	.editor-columns { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; }
	.editor-column { min-height:180px; padding:12px; border:1px dashed var(--color-border-strong); border-radius:var(--r-card); background:var(--color-canvas); }
	.editor-column h3 { margin:0 0 10px; color:var(--color-text-muted); font-size:11px; text-transform:uppercase; letter-spacing:.06em; }
	.editor-widget { display:flex; align-items:center; gap:7px; margin-bottom:8px; padding:9px; border:1px solid var(--color-border); border-radius:var(--r-btn); background:var(--color-surface); font-size:12px; cursor:grab; }
	.editor-widget strong { flex:1; }
	.drag-handle { color:var(--color-text-subtle); }
	.widget-controls { display:flex; align-items:center; gap:3px; }
	.widget-controls select { width:64px; padding:3px; font-size:10px; }
	.mini { min-width:24px; height:24px; padding:0; border:1px solid var(--color-border); border-radius:4px; background:transparent; color:var(--color-text-muted); cursor:pointer; }
	.drop-target { padding:24px 8px; color:var(--color-text-subtle); font-size:11px; text-align:center; }
	.hidden-widgets { display:flex; align-items:center; flex-wrap:wrap; gap:8px; padding:10px; border:1px solid var(--color-border); border-radius:var(--r-btn); font-size:12px; }
	@media (max-width: 800px) { .editor-columns { grid-template-columns:1fr; } }
</style>
