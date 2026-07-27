<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import { slaState } from '$lib/sla';
	import { TICKET_COLUMNS } from '$lib/ticketColumns';
	import { PAGE_SIZE_OPTIONS } from '$lib/ticketPageSize';
	import ColumnChooserModal from '$lib/components/ColumnChooserModal.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import TicketNumber from '$lib/components/TicketNumber.svelte';
	import { openTicketWorkspace } from '$lib/ticketWorkspaceWindow';

	let { data }: { data: PageData } = $props();

	let chooserOpen = $state(false);
	let columns = $derived(data.visibleColumns.map((key) => TICKET_COLUMNS.find((c) => c.key === key)!));

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
		url.searchParams.delete('page');
		if (value) url.searchParams.set(name, value);
		else url.searchParams.delete(name);
		goto(url, { keepFocus: true, noScroll: true });
	}

	function quickFilter(name: 'mine' | 'all' | 'unassigned' | 'needsAttention') {
		const current = new URL(page.url);
		const sort = current.searchParams.get('sort');
		const dir = current.searchParams.get('dir');
		const params = new URLSearchParams({ [name]: '1' });
		if (sort) params.set('sort', sort);
		if (dir) params.set('dir', dir);
		goto(`/tickets?${params.toString()}`, { keepFocus: true, noScroll: true });
	}

	function setSort(key: string) {
		const url = new URL(page.url);
		const currentSort = url.searchParams.get('sort');
		const currentDir = url.searchParams.get('dir');
		const nextDir = currentSort === key && currentDir === 'asc' ? 'desc' : 'asc';
		url.searchParams.set('sort', key);
		url.searchParams.set('dir', nextDir);
		url.searchParams.delete('page');
		goto(url, { keepFocus: true, noScroll: true });
	}

	function goToPage(n: number) {
		const url = new URL(page.url);
		url.searchParams.set('page', String(n));
		goto(url, { keepFocus: true, noScroll: true });
	}

	function setPageSize(n: number) {
		// Persist as the user's remembered default (fire-and-forget — this
		// view's own re-render below is what the user actually waits on).
		const form = new FormData();
		form.set('pageSize', String(n));
		fetch('?/savePageSize', { method: 'POST', body: form });

		// Apply immediately to the current view.
		const url = new URL(page.url);
		url.searchParams.set('pageSize', String(n));
		url.searchParams.delete('page');
		goto(url, { keepFocus: true, noScroll: true });
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
		<span class="section-card-title">Tickets <span class="row-count-badge">{data.total}</span></span>
		<button class="btn btn-ghost btn-sm" onclick={() => (chooserOpen = true)}>
			<Icon name="columns" class="btn-icon" />
			Columns
		</button>
	</div>
	<table>
		<thead>
			<tr>
				{#each columns as col (col.key)}
					{#if col.sortable}
						<th class="sortable-th" onclick={() => setSort(col.key)}>
							{col.label}
							{#if data.sort === col.key}
								<Icon name="chevron" class="sort-chevron {data.dir === 'asc' ? 'is-asc' : ''}" />
							{/if}
						</th>
					{:else}
						<th>{col.label}</th>
					{/if}
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each data.tickets as t (t.id)}
				{@const sla = rowSlaState(t)}
				<tr onclick={() => openTicketWorkspace(t.id)} style="cursor: pointer;">
					{#each columns as col (col.key)}
						{#if col.key === 'ticketNumber'}
							<td><a href={`/tickets/${t.id}`} onclick={(event) => { event.preventDefault(); event.stopPropagation(); openTicketWorkspace(t.id); }}><TicketNumber value={t.ticketNumber} /></a></td>
						{:else if col.key === 'title'}
							<td>
								{t.title}
								{#if t.needsTechAttention}<span class="badge badge-warning" style="margin-left:6px;">Needs Attention</span>{/if}
							</td>
						{:else if col.key === 'company'}
							<td>{t.companyName}</td>
						{:else if col.key === 'queue'}
							<td>{t.queueName}</td>
						{:else if col.key === 'status'}
							<td><span class="badge badge-muted">{statusLabels[t.status]}</span></td>
						{:else if col.key === 'priority'}
							<td>{t.priority ? t.priority : '—'}</td>
						{:else if col.key === 'sla'}
							<td><span class="badge {slaBadgeClass[sla]}">{slaLabel[sla]}</span></td>
						{:else if col.key === 'assigned'}
							<td>{t.assignedResourceName ?? '—'}</td>
						{:else if col.key === 'contact'}
							<td>{t.contactName ?? '—'}</td>
						{:else if col.key === 'issueType'}
							<td>{t.issueTypeName ?? '—'}</td>
						{:else if col.key === 'source'}
							<td>{t.source}</td>
						{:else if col.key === 'createdAt'}
							<td>{new Date(t.createdAt * 1000).toLocaleDateString()}</td>
						{/if}
					{/each}
				</tr>
			{:else}
				<tr><td colspan={columns.length} class="empty">No tickets match this view.</td></tr>
			{/each}
		</tbody>
	</table>
	<div class="pagination">
		<div style="display:flex; gap:14px; align-items:center;">
			<span class="pagination-info">
				{#if data.total === 0}
					No tickets
				{:else}
					Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total}
				{/if}
			</span>
			<label class="pagination-info" style="display:flex; align-items:center; gap:6px;">
				Rows per page
				<select value={data.pageSize} onchange={(e) => setPageSize(Number((e.currentTarget as HTMLSelectElement).value))}>
					{#each PAGE_SIZE_OPTIONS as size (size)}
						<option value={size}>{size}</option>
					{/each}
				</select>
			</label>
		</div>
		<div style="display:flex; gap:8px; align-items:center;">
			<button class="btn btn-ghost btn-sm" disabled={data.page <= 1} onclick={() => goToPage(data.page - 1)}>Prev</button>
			<span class="pagination-info">Page {data.page} of {data.totalPages}</span>
			<button class="btn btn-ghost btn-sm" disabled={data.page >= data.totalPages} onclick={() => goToPage(data.page + 1)}>Next</button>
		</div>
	</div>
</div>

<ColumnChooserModal bind:open={chooserOpen} visibleColumns={data.visibleColumns} />
