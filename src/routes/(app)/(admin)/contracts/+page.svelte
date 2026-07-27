<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import {
		CONTRACT_STATUSES,
		CONTRACT_STATUS_LABELS,
		CONTRACT_TYPES,
		CONTRACT_TYPE_LABELS,
		BILLING_MODEL_LABELS,
		formatDateOnly
	} from '$lib/contracts';
	import { PAGE_SIZE_OPTIONS } from '$lib/ticketPageSize';
	import Icon from '$lib/components/Icon.svelte';

	let { data }: { data: PageData } = $props();
	let searchValue = $state('');

	$effect(() => {
		searchValue = data.filters.q;
	});

	const hasFilters = $derived(data.filters.q !== '' || data.filters.status !== 'all' || data.filters.type !== 'all');

	function updateParams(changes: Record<string, string | null>) {
		const url = new URL(page.url);
		for (const [name, value] of Object.entries(changes)) {
			if (value) url.searchParams.set(name, value);
			else url.searchParams.delete(name);
		}
		url.searchParams.delete('page');
		goto(url, { keepFocus: true, noScroll: true });
	}

	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		updateParams({ q: searchValue.trim() || null });
	}

	function clearFilters() {
		searchValue = '';
		const url = new URL(page.url);
		for (const key of ['q', 'status', 'type', 'page']) url.searchParams.delete(key);
		goto(url, { keepFocus: true, noScroll: true });
	}

	function setSort(key: PageData['sort']) {
		updateParams({ sort: key, dir: data.sort === key && data.dir === 'asc' ? 'desc' : 'asc' });
	}

	function goToPage(pageNumber: number) {
		const url = new URL(page.url);
		url.searchParams.set('page', String(pageNumber));
		goto(url, { keepFocus: true, noScroll: true });
	}

	function setPageSize(pageSize: number) {
		const form = new FormData();
		form.set('pageSize', String(pageSize));
		fetch('?/savePageSize', { method: 'POST', body: form });
		updateParams({ pageSize: String(pageSize) });
	}

	const statusBadge: Record<string, string> = {
		draft: 'badge-muted',
		active: 'badge-success',
		expired: 'badge-warning',
		terminated: 'badge-danger'
	};
</script>

<svelte:head><title>Contracts — Keep</title></svelte:head>

<div class="pf-topbar">
	<h1>Contracts</h1>
	<a class="btn btn-primary" href="/contracts/new">+ New Contract</a>
</div>

<div class="contract-controls">
	<form class="contract-search" onsubmit={submitSearch}>
		<label class="sr-only" for="contract-search">Search contracts</label>
		<input id="contract-search" type="search" placeholder="Search contracts or companies" bind:value={searchValue} />
		<button class="btn btn-primary btn-sm" type="submit">Search</button>
	</form>
	<div class="contract-filters">
		<label>
			<span>Status</span>
			<select value={data.filters.status} onchange={(e) => updateParams({ status: (e.currentTarget as HTMLSelectElement).value === 'all' ? null : (e.currentTarget as HTMLSelectElement).value })}>
				<option value="all">All</option>
				{#each CONTRACT_STATUSES as status (status)}<option value={status}>{CONTRACT_STATUS_LABELS[status]}</option>{/each}
			</select>
		</label>
		<label>
			<span>Type</span>
			<select value={data.filters.type} onchange={(e) => updateParams({ type: (e.currentTarget as HTMLSelectElement).value === 'all' ? null : (e.currentTarget as HTMLSelectElement).value })}>
				<option value="all">All</option>
				{#each CONTRACT_TYPES as type (type)}<option value={type}>{CONTRACT_TYPE_LABELS[type]}</option>{/each}
			</select>
		</label>
		{#if hasFilters}<button class="btn btn-ghost btn-sm" type="button" onclick={clearFilters}>Clear filters</button>{/if}
	</div>
</div>

<div class="section-card">
	<div class="section-card-head">
		<span class="section-card-title">Contracts <span class="row-count-badge">{data.total}</span></span>
	</div>
	<div class="table-scroll">
		<table>
			<thead>
				<tr>
					{#each [
						['name', 'Contract'],
						['company', 'Company'],
						['status', 'Status'],
						['type', 'Type'],
						['startDate', 'Start'],
						['endDate', 'End']
					] as [key, label] (key)}
						<th class="sortable-th" onclick={() => setSort(key as PageData['sort'])}>
							{label}
							{#if data.sort === key}<Icon name="chevron" class="sort-chevron {data.dir === 'asc' ? 'is-asc' : ''}" />{/if}
						</th>
					{/each}
					<th>Billing</th>
				</tr>
			</thead>
			<tbody>
				{#each data.contracts as contract (contract.id)}
					<tr onclick={() => goto(`/contracts/${contract.id}`)} style="cursor:pointer;">
						<td class="contract-name">
							{contract.name}
							{#if contract.isDefault}<span class="badge badge-muted">Default</span>{/if}
						</td>
						<td>{contract.companyName}</td>
						<td><span class="badge {statusBadge[contract.status]}">{CONTRACT_STATUS_LABELS[contract.status]}</span></td>
						<td>{CONTRACT_TYPE_LABELS[contract.type]}</td>
						<td>{formatDateOnly(contract.startDate)}</td>
						<td>{contract.endDate ? formatDateOnly(contract.endDate) : 'Ongoing'}</td>
						<td>{BILLING_MODEL_LABELS[contract.billingModel]}</td>
					</tr>
				{:else}
					<tr>
						<td colspan="7" class="empty">
							{#if hasFilters}
								<div class="empty-title">No contracts match these filters.</div>
								<button class="btn btn-ghost btn-sm" type="button" onclick={clearFilters}>Clear filters</button>
							{:else}
								No contracts yet.
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="pagination">
		<div class="pagination-left">
			<span class="pagination-info">
				{#if data.total === 0}No contracts{:else}Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total}{/if}
			</span>
			<label class="pagination-info rows-per-page">
				Rows per page
				<select value={data.pageSize} onchange={(e) => setPageSize(Number((e.currentTarget as HTMLSelectElement).value))}>
					{#each PAGE_SIZE_OPTIONS as size (size)}<option value={size}>{size}</option>{/each}
				</select>
			</label>
		</div>
		<div class="pagination-right">
			<button class="btn btn-ghost btn-sm" disabled={data.page <= 1} onclick={() => goToPage(data.page - 1)}>Prev</button>
			<span class="pagination-info">Page {data.page} of {data.totalPages}</span>
			<button class="btn btn-ghost btn-sm" disabled={data.page >= data.totalPages} onclick={() => goToPage(data.page + 1)}>Next</button>
		</div>
	</div>
</div>

<style>
	.contract-controls { display:flex; justify-content:space-between; align-items:end; gap:16px; margin-bottom:16px; flex-wrap:wrap; }
	.contract-search { display:flex; gap:8px; flex:1 1 380px; max-width:620px; }
	.contract-search input { min-width:0; flex:1; }
	.contract-filters { display:flex; align-items:end; gap:10px; flex-wrap:wrap; }
	.contract-filters label { display:grid; gap:4px; color:var(--color-text-muted); font-size:11px; font-weight:600; }
	.contract-filters select { min-width:135px; }
	.table-scroll { overflow-x:auto; }
	.contract-name { font-weight:600; white-space:nowrap; }
	.contract-name .badge { margin-left:6px; }
	.empty-title { margin-bottom:8px; }
	.pagination-left, .pagination-right, .rows-per-page { display:flex; align-items:center; }
	.pagination-left { gap:14px; }
	.pagination-right { gap:8px; }
	.rows-per-page { gap:6px; }
	@media (max-width:720px) {
		.contract-controls, .contract-search { align-items:stretch; }
		.contract-search { max-width:none; }
		.pagination { align-items:flex-start; gap:12px; flex-direction:column; }
	}
</style>
