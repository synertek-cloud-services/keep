<script lang="ts">
	import { enhance } from '$app/forms';
	import { TICKET_COLUMNS, type TicketColumnKey } from '$lib/ticketColumns';

	let { open = $bindable(), visibleColumns }: { open: boolean; visibleColumns: TicketColumnKey[] } = $props();

	let selected = $state<TicketColumnKey[]>([...visibleColumns]);
	let available = $derived(TICKET_COLUMNS.map((c) => c.key).filter((k) => !selected.includes(k)));
	let highlighted = $state<TicketColumnKey | null>(null);

	// Re-sync from the current saved prefs every time the modal opens — the
	// component itself is mounted once by the parent (only the {#if open}
	// block inside toggles), so without this `selected` would freeze at
	// whatever `visibleColumns` was at first mount and never pick up a
	// just-saved change the next time the chooser is reopened.
	$effect(() => {
		if (open) {
			selected = [...visibleColumns];
			highlighted = null;
		}
	});

	function label(key: TicketColumnKey): string {
		return TICKET_COLUMNS.find((c) => c.key === key)!.label;
	}

	function moveToSelected() {
		if (highlighted && available.includes(highlighted)) selected = [...selected, highlighted];
	}
	function moveToAvailable() {
		if (highlighted && selected.includes(highlighted)) selected = selected.filter((k) => k !== highlighted);
	}
	function moveUp() {
		const i = selected.indexOf(highlighted!);
		if (i > 0) {
			const c = [...selected];
			[c[i - 1], c[i]] = [c[i], c[i - 1]];
			selected = c;
		}
	}
	function moveDown() {
		const i = selected.indexOf(highlighted!);
		if (i >= 0 && i < selected.length - 1) {
			const c = [...selected];
			[c[i], c[i + 1]] = [c[i + 1], c[i]];
			selected = c;
		}
	}
</script>

{#if open}
	<div class="modal-backdrop">
		<div class="modal" style="width: 640px;">
			<div class="modal-header">Choose Columns</div>
			<div class="modal-body" style="display:flex; gap:16px;">
				<div class="col-pane">
					<div class="col-pane-title">Available Columns</div>
					<ul>
						{#each available as key (key)}
							<li
								class:highlighted={highlighted === key}
								role="option"
								aria-selected={highlighted === key}
								tabindex="0"
								onclick={() => (highlighted = key)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										highlighted = key;
									}
								}}
							>{label(key)}</li>
						{/each}
					</ul>
				</div>
				<div class="col-pane-buttons">
					<button class="btn btn-sm" type="button" onclick={moveToSelected}>→</button>
					<button class="btn btn-sm" type="button" onclick={moveToAvailable}>←</button>
					<button class="btn btn-sm" type="button" onclick={moveUp}>↑</button>
					<button class="btn btn-sm" type="button" onclick={moveDown}>↓</button>
				</div>
				<div class="col-pane">
					<div class="col-pane-title">Selected Columns</div>
					<ul>
						{#each selected as key (key)}
							<li
								class:highlighted={highlighted === key}
								role="option"
								aria-selected={highlighted === key}
								tabindex="0"
								onclick={() => (highlighted = key)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										highlighted = key;
									}
								}}
							>{label(key)}</li>
						{/each}
					</ul>
				</div>
			</div>
			<div class="modal-footer">
				<button class="btn btn-ghost btn-sm" type="button" onclick={() => (open = false)}>Cancel</button>
				<form
					method="POST"
					action="?/saveColumns"
					use:enhance={() => async ({ update }) => {
						await update();
						open = false;
					}}
				>
					<input type="hidden" name="columns" value={JSON.stringify(selected)} />
					<button class="btn btn-primary btn-sm" type="submit">Save &amp; Close</button>
				</form>
			</div>
		</div>
	</div>
{/if}

<style>
	.col-pane { flex: 1; border: 1px solid var(--color-border-strong); border-radius: var(--r-btn); min-height: 240px; }
	.col-pane-title { padding: 8px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid var(--color-border); }
	.col-pane ul { list-style: none; margin: 0; padding: 4px; }
	.col-pane li { padding: 6px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; }
	.col-pane li.highlighted { background: var(--color-primary); color: #fff; }
	.col-pane-buttons { display: flex; flex-direction: column; justify-content: center; gap: 6px; }
</style>
