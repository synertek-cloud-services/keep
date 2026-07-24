<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import { slaState } from '$lib/sla';

	let { data }: { data: PageData } = $props();

	const statusLabels: Record<string, string> = {
		triage: 'Triage',
		new: 'New',
		in_progress: 'In Progress',
		waiting_on_client: 'Waiting on Client',
		waiting_on_vendor: 'Waiting on Vendor',
		resolved: 'Resolved',
		closed: 'Closed'
	};

	function setParam(name: string, value: string | null) {
		const url = new URL(page.url);
		url.searchParams.delete('mine');
		url.searchParams.delete('all');
		url.searchParams.delete('unassigned');
		url.searchParams.delete('needsAttention');
		if (value) url.searchParams.set(name, value);
		else url.searchParams.delete(name);
		goto(url, { keepFocus: true, noScroll: true });
	}

	function quickFilter(name: 'mine' | 'all' | 'unassigned' | 'needsAttention') {
		goto(`/tickets?${name}=1`, { keepFocus: true, noScroll: true });
	}

	function rowSlaState(t: PageData['tickets'][number]): ReturnType<typeof slaState> {
		const now = Math.floor(Date.now() / 1000);
		if (t.status === 'triage') return slaState(now, t.createdAt, t.triageDueAt);
		return slaState(now, t.slaClockStartedAt, t.resolutionDueAt);
	}

	const slaBadgeClass: Record<string, string> = {
		none: 'badge-muted',
		on_track: 'badge-success',
		at_risk: 'badge-warning',
		breached: 'badge-danger'
	};
	const slaLabel: Record<string, string> = {
		none: '—',
		on_track: 'On track',
		at_risk: 'At risk',
		breached: 'Breached'
	};
</script>

<svelte:head>
	<title>Tickets — Keep</title>
</svelte:head>

<div class="pf-topbar">
	<h1>Tickets</h1>
	<a class="btn btn-primary" href="/tickets/new">+ New Ticket</a>
</div>

<div style="display:flex; gap:8px; margin-bottom: 16px; flex-wrap: wrap;">
	<button class="btn btn-sm" class:btn-primary={data.filters.mine} class:btn-ghost={!data.filters.mine} onclick={() => quickFilter('mine')}>My Tickets</button>
	<button class="btn btn-sm" class:btn-primary={data.filters.all} class:btn-ghost={!data.filters.all} onclick={() => quickFilter('all')}>All Tickets</button>
	<button class="btn btn-sm" class:btn-primary={data.filters.unassigned} class:btn-ghost={!data.filters.unassigned} onclick={() => quickFilter('unassigned')}>Unassigned</button>
	<button class="btn btn-sm" class:btn-primary={data.filters.needsAttention} class:btn-ghost={!data.filters.needsAttention} onclick={() => quickFilter('needsAttention')}>Needs Attention</button>
</div>

<div style="display:flex; gap:10px; margin-bottom: 16px; flex-wrap: wrap;">
	<select onchange={(e) => setParam('queue', (e.currentTarget as HTMLSelectElement).value || null)} value={data.filters.queue ?? ''}>
		<option value="">All Queues</option>
		{#each data.queues as q (q.id)}
			<option value={q.id}>{q.name}</option>
		{/each}
	</select>
	<select onchange={(e) => setParam('status', (e.currentTarget as HTMLSelectElement).value || null)} value={data.filters.status ?? ''}>
		<option value="">All Statuses</option>
		{#each Object.entries(statusLabels) as [value, label] (value)}
			<option {value}>{label}</option>
		{/each}
	</select>
	<select onchange={(e) => setParam('priority', (e.currentTarget as HTMLSelectElement).value || null)} value={data.filters.priority ?? ''}>
		<option value="">All Priorities</option>
		<option value="critical">Critical</option>
		<option value="high">High</option>
		<option value="medium">Medium</option>
		<option value="low">Low</option>
	</select>
	<select onchange={(e) => setParam('issueType', (e.currentTarget as HTMLSelectElement).value || null)} value={data.filters.issueType ?? ''}>
		<option value="">All Issue Types</option>
		{#each data.issueTypes as it (it.id)}
			<option value={it.id}>{it.name}</option>
		{/each}
	</select>
</div>

<div class="section-card">
	<div class="section-card-head">
		<span class="section-card-title">Tickets <span class="row-count-badge">{data.tickets.length}</span></span>
	</div>
	<table>
		<thead>
			<tr>
				<th>Ticket</th>
				<th>Title</th>
				<th>Company</th>
				<th>Queue</th>
				<th>Status</th>
				<th>Priority</th>
				<th>SLA</th>
				<th>Assigned</th>
			</tr>
		</thead>
		<tbody>
			{#each data.tickets as t (t.id)}
				{@const sla = rowSlaState(t)}
				<tr onclick={() => goto(`/tickets/${t.id}`)} style="cursor: pointer;">
					<td style="font-family: var(--mono); font-size: 11px;">{t.ticketNumber}</td>
					<td>
						{t.title}
						{#if t.needsTechAttention}<span class="badge badge-warning" style="margin-left:6px;">Needs Attention</span>{/if}
					</td>
					<td>{t.companyName}</td>
					<td>{t.queueName}</td>
					<td><span class="badge badge-muted">{statusLabels[t.status]}</span></td>
					<td>{t.priority ? t.priority : '—'}</td>
					<td><span class="badge {slaBadgeClass[sla]}">{slaLabel[sla]}</span></td>
					<td>{t.assignedResourceName ?? '—'}</td>
				</tr>
			{:else}
				<tr><td colspan="8" class="empty">No tickets match this view.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
