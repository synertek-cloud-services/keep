<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import DonutChart from '$lib/components/DonutChart.svelte';
	import TicketNumber from '$lib/components/TicketNumber.svelte';
	import { openTicketWorkspace } from '$lib/ticketWorkspaceWindow';

	// Fixed palette so chart segment colors stay consistent across reloads.
	const PALETTE = ['#4169e1', '#2dcfa0', '#f0a840', '#e8566a', '#a2a8c1', '#7f86a3'];

	let { data }: { data: PageData } = $props();
	let editMode = $state(false);
	let draggedId = $state<string | null>(null);

	function colorFor(index: number): string {
		return PALETTE[index % PALETTE.length];
	}

	async function patchWidget(id: string, updates: Record<string, number>) {
		await fetch(`/dashboard/widgets/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});
	}

	async function removeWidget(id: string) {
		await fetch(`/dashboard/widgets/${id}`, { method: 'DELETE' });
		await invalidateAll();
	}

	let addingType = $state('');
	async function addWidget() {
		if (!addingType) return;
		await fetch('/dashboard/widgets', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: addingType })
		});
		addingType = '';
		await invalidateAll();
	}

	function onDragStart(id: string) {
		draggedId = id;
	}

	async function onDrop(targetId: string) {
		if (!draggedId || draggedId === targetId) return;
		const source = data.widgets.find((w) => w.id === draggedId);
		const target = data.widgets.find((w) => w.id === targetId);
		if (!source || !target) return;

		const sourcePos = { gridX: source.gridX, gridY: source.gridY };
		const targetPos = { gridX: target.gridX, gridY: target.gridY };
		await Promise.all([patchWidget(source.id, targetPos), patchWidget(target.id, sourcePos)]);
		draggedId = null;
		await invalidateAll();
	}

	async function resize(id: string, currentW: number, delta: number) {
		const nextW = Math.min(12, Math.max(2, currentW + delta));
		await patchWidget(id, { gridW: nextW });
		await invalidateAll();
	}

	// Mirrors lib/server/dashboardData.ts's WIDGET_TYPES — duplicated, not
	// imported, because this component runs client-side too and SvelteKit
	// forbids importing $lib/server/* into client-reachable code.
	const availableTypes = [
		{ type: 'unassigned_count', title: 'Unassigned Tickets' },
		{ type: 'untriaged_count', title: 'Untriaged Tickets' },
		{ type: 'sla_breaches_today', title: 'SLA Breaches Today' },
		{ type: 'needs_attention_count', title: 'Needs Attention' },
		{ type: 'open_by_status', title: 'Open Tickets by Status' },
		{ type: 'open_by_priority', title: 'Open Tickets by Priority' },
		{ type: 'open_by_queue', title: 'Open Tickets by Queue' },
		{ type: 'oldest_open_tickets', title: 'Oldest Open Tickets' },
		{ type: 'tickets_per_tech', title: 'Tickets per Tech' },
		{ type: 'sla_at_risk_tickets', title: 'SLA At-Risk Tickets' }
	];
</script>

<svelte:head>
	<title>Dashboard — Keep</title>
</svelte:head>

<div class="pf-topbar">
	<h1>{data.dashboard?.name ?? 'Overview'}</h1>
	{#if data.user?.role === 'admin'}
		<button class="btn btn-sm" class:btn-primary={editMode} class:btn-ghost={!editMode} onclick={() => (editMode = !editMode)}>
			{editMode ? 'Done Editing' : 'Edit Layout'}
		</button>
	{/if}
</div>

{#if editMode}
	<div style="display:flex; gap:10px; align-items:end; margin-bottom: 16px;">
		<div class="field" style="margin-bottom:0; flex:1;">
			<label for="addWidgetType">Add widget</label>
			<select id="addWidgetType" bind:value={addingType}>
				<option value="">Select a widget type…</option>
				{#each availableTypes as t (t.type)}
					<option value={t.type}>{t.title}</option>
				{/each}
			</select>
		</div>
		<button class="btn btn-primary btn-sm" type="button" onclick={addWidget} disabled={!addingType}>Add</button>
	</div>
{/if}

<div class="dash-grid" style="display:grid; grid-template-columns: repeat(12, 1fr); grid-auto-rows: 40px; gap: 14px;">
	{#each data.widgets as w (w.id)}
		<div
			role="group"
			aria-label={w.title ?? w.type}
			style="grid-column: {w.gridX + 1} / span {w.gridW}; grid-row: {w.gridY + 1} / span {w.gridH}; position: relative;"
			draggable={editMode}
			ondragstart={() => onDragStart(w.id)}
			ondragover={(e) => e.preventDefault()}
			ondrop={() => onDrop(w.id)}
		>
			{#if editMode}
				<div style="position:absolute; top:-10px; right:0; z-index:10; display:flex; gap:4px;">
					<button class="btn btn-ghost btn-sm" type="button" onclick={() => resize(w.id, w.gridW, -1)} title="Narrower">−</button>
					<button class="btn btn-ghost btn-sm" type="button" onclick={() => resize(w.id, w.gridW, 1)} title="Wider">+</button>
					<button class="btn btn-danger btn-sm" type="button" onclick={() => removeWidget(w.id)} title="Remove">×</button>
				</div>
			{/if}

			{#if w.type === 'unassigned_count'}
				<div class="stat-card c-blue" style="height:100%;">
					<div class="stat-label">{w.title}</div>
					<div class="stat-value">{data.data.bigNumbers.unassignedCount}</div>
				</div>
			{:else if w.type === 'untriaged_count'}
				<div class="stat-card c-amber has-sub" style="height:100%;">
					<div class="stat-label">{w.title}</div>
					<div class="stat-value">{data.data.bigNumbers.untriagedCount}</div>
					{#if data.data.bigNumbers.oldestUntriagedAgeMinutes != null}
						<div class="stat-sub">Oldest: {data.data.bigNumbers.oldestUntriagedAgeMinutes}m ago</div>
					{/if}
				</div>
			{:else if w.type === 'sla_breaches_today'}
				<div class="stat-card c-red" style="height:100%;">
					<div class="stat-label">{w.title}</div>
					<div class="stat-value">{data.data.bigNumbers.slaBreachesToday}</div>
				</div>
			{:else if w.type === 'needs_attention_count'}
				<div class="stat-card c-amber" style="height:100%;">
					<div class="stat-label">{w.title}</div>
					<div class="stat-value">{data.data.bigNumbers.needsAttentionCount}</div>
				</div>
			{:else if w.type === 'open_by_status'}
				<div class="chart-card" style="height:100%;">
					<div class="chart-card-title">{w.title}</div>
					<DonutChart data={data.data.charts.openByStatus.map((d, i) => ({ ...d, color: colorFor(i) }))} centerLabel="Open" />
				</div>
			{:else if w.type === 'open_by_priority'}
				<div class="chart-card" style="height:100%;">
					<div class="chart-card-title">{w.title}</div>
					<DonutChart data={data.data.charts.openByPriority.map((d, i) => ({ ...d, color: colorFor(i) }))} centerLabel="Open" />
				</div>
			{:else if w.type === 'open_by_queue'}
				<div class="chart-card" style="height:100%;">
					<div class="chart-card-title">{w.title}</div>
					<DonutChart data={data.data.charts.openByQueue.map((d, i) => ({ ...d, color: colorFor(i) }))} centerLabel="Open" />
				</div>
			{:else if w.type === 'oldest_open_tickets'}
				<div class="section-card" style="height:100%; margin-bottom:0; overflow:auto;">
					<div class="section-card-head"><span class="section-card-title">{w.title}</span></div>
					<table>
						<tbody>
							{#each data.data.lists.oldestOpenTickets as t (t.id)}
								<tr onclick={() => openTicketWorkspace(t.id)} style="cursor:pointer;">
									<td><a href={`/tickets/${t.id}`} onclick={(event) => { event.preventDefault(); event.stopPropagation(); openTicketWorkspace(t.id); }}><TicketNumber value={t.ticketNumber} /></a></td>
									<td>{t.title}</td>
									<td style="color: var(--color-text-muted);">{t.companyName}</td>
								</tr>
							{:else}
								<tr><td class="empty">No open tickets.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else if w.type === 'tickets_per_tech'}
				<div class="section-card" style="height:100%; margin-bottom:0; overflow:auto;">
					<div class="section-card-head"><span class="section-card-title">{w.title}</span></div>
					<table>
						<tbody>
							{#each data.data.lists.ticketsPerTech as t (t.resourceName)}
								<tr>
									<td>{t.resourceName}</td>
									<td style="text-align:right; font-family: var(--mono);">{t.count}</td>
								</tr>
							{:else}
								<tr><td class="empty">No assigned open tickets.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else if w.type === 'sla_at_risk_tickets'}
				<div class="section-card" style="height:100%; margin-bottom:0; overflow:auto;">
					<div class="section-card-head"><span class="section-card-title">{w.title}</span></div>
					<table>
						<tbody>
							{#each data.data.lists.slaAtRiskTickets as t (t.id)}
								<tr onclick={() => openTicketWorkspace(t.id)} style="cursor:pointer;">
									<td><a href={`/tickets/${t.id}`} onclick={(event) => { event.preventDefault(); event.stopPropagation(); openTicketWorkspace(t.id); }}><TicketNumber value={t.ticketNumber} /></a></td>
									<td>{t.title}</td>
									<td><span class="badge badge-warning">{t.slaLabel}</span></td>
								</tr>
							{:else}
								<tr><td class="empty">No at-risk tickets.</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/each}
</div>

{#if data.widgets.length === 0}
	<div class="empty">No widgets configured.</div>
{/if}

<style>
	/* Two-row stat widgets are 94px tall. The subtitle variant needs a
	   tighter vertical rhythm so its final line clears the card border. */
	.stat-card.has-sub { padding-block: 10px; gap: 2px; }
	.stat-card.has-sub .stat-sub { margin-top: auto; padding-bottom: 2px; }
</style>
