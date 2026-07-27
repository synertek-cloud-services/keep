<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import { PAGE_SIZE_OPTIONS } from '$lib/ticketPageSize';
	import Icon from '$lib/components/Icon.svelte';

	let { data }: { data: PageData } = $props();
	let searchValue = $state('');

	$effect(() => {
		searchValue = data.filters.q;
	});

	const hasFilters = $derived(
		data.filters.q !== '' || data.filters.status !== 'active' || data.filters.type !== 'all'
	);

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
		const url = new URL(page.url);
		const nextDir = data.sort === key && data.dir === 'asc' ? 'desc' : 'asc';
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
		const form = new FormData();
		form.set('pageSize', String(n));
		fetch('?/savePageSize', { method: 'POST', body: form });

		const url = new URL(page.url);
		url.searchParams.set('pageSize', String(n));
		url.searchParams.delete('page');
		goto(url, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>Companies — Keep</title>
</svelte:head>

<div class="pf-topbar">
	<h1>Companies</h1>
	<a class="btn btn-primary" href="/companies/new">+ New Company</a>
</div>

<div class="company-controls">
	<form class="company-search" onsubmit={submitSearch}>
		<label class="sr-only" for="company-search">Search companies</label>
		<input
			id="company-search"
			type="search"
			placeholder="Search companies or external references"
			bind:value={searchValue}
		/>
		<button class="btn btn-primary btn-sm" type="submit">Search</button>
	</form>
	<div class="company-filters">
		<label>
			<span>Status</span>
			<select
				value={data.filters.status}
				onchange={(e) => updateParams({ status: (e.currentTarget as HTMLSelectElement).value === 'active' ? null : (e.currentTarget as HTMLSelectElement).value })}
			>
				<option value="active">Active</option>
				<option value="inactive">Inactive</option>
				<option value="all">All</option>
			</select>
		</label>
		<label>
			<span>Type</span>
			<select
				value={data.filters.type}
				onchange={(e) => updateParams({ type: (e.currentTarget as HTMLSelectElement).value === 'all' ? null : (e.currentTarget as HTMLSelectElement).value })}
			>
				<option value="all">All</option>
				<option value="client">Client</option>
				<option value="internal">Internal</option>
			</select>
		</label>
		{#if hasFilters}
			<button class="btn btn-ghost btn-sm" type="button" onclick={clearFilters}>Clear filters</button>
		{/if}
	</div>
</div>

<div class="section-card">
	<div class="section-card-head">
		<span class="section-card-title">Companies <span class="row-count-badge">{data.total}</span></span>
	</div>
	<div class="table-scroll">
		<table>
			<thead>
				<tr>
					<th class="sortable-th" onclick={() => setSort('name')}>
						Company
						{#if data.sort === 'name'}<Icon name="chevron" class="sort-chevron {data.dir === 'asc' ? 'is-asc' : ''}" />{/if}
					</th>
					<th>Primary Contact</th>
					<th class="sortable-th" onclick={() => setSort('type')}>
						Type
						{#if data.sort === 'type'}<Icon name="chevron" class="sort-chevron {data.dir === 'asc' ? 'is-asc' : ''}" />{/if}
					</th>
					<th class="sortable-th" onclick={() => setSort('slaPolicy')}>
						SLA Policy
						{#if data.sort === 'slaPolicy'}<Icon name="chevron" class="sort-chevron {data.dir === 'asc' ? 'is-asc' : ''}" />{/if}
					</th>
					<th class="sortable-th" onclick={() => setSort('status')}>
						Status
						{#if data.sort === 'status'}<Icon name="chevron" class="sort-chevron {data.dir === 'asc' ? 'is-asc' : ''}" />{/if}
					</th>
				</tr>
			</thead>
			<tbody>
				{#each data.companies as company (company.id)}
					<tr onclick={() => goto(`/companies/${company.id}`)} style="cursor: pointer;">
						<td class="company-name">{company.name}</td>
						<td>
							{#if company.primaryContactName}
								<div class="contact-name">{company.primaryContactName}</div>
								{#if company.primaryContactEmail}<div class="contact-email">{company.primaryContactEmail}</div>{/if}
							{:else}
								<span class="muted">—</span>
							{/if}
						</td>
						<td><span class="badge badge-muted">{company.type}</span></td>
						<td>{company.slaPolicyName ?? '—'}</td>
						<td>
							<span class="badge" class:badge-success={company.status === 'active'} class:badge-muted={company.status !== 'active'}>
								{company.status}
							</span>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="5" class="empty">
							{#if hasFilters}
								<div class="empty-title">No companies match these filters.</div>
								<button class="btn btn-ghost btn-sm" type="button" onclick={clearFilters}>Clear filters</button>
							{:else}
								No companies yet.
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
				{#if data.total === 0}
					No companies
				{:else}
					Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total}
				{/if}
			</span>
			<label class="pagination-info rows-per-page">
				Rows per page
				<select value={data.pageSize} onchange={(e) => setPageSize(Number((e.currentTarget as HTMLSelectElement).value))}>
					{#each PAGE_SIZE_OPTIONS as size (size)}
						<option value={size}>{size}</option>
					{/each}
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
	.company-controls {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 16px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}
	.company-search { display: flex; gap: 8px; flex: 1 1 380px; max-width: 620px; }
	.company-search input { min-width: 0; flex: 1; }
	.company-filters { display: flex; align-items: end; gap: 10px; flex-wrap: wrap; }
	.company-filters label { display: grid; gap: 4px; color: var(--color-text-muted); font-size: 11px; font-weight: 600; }
	.company-filters select { min-width: 112px; }
	.table-scroll { overflow-x: auto; }
	.company-name { font-weight: 600; color: var(--color-text); }
	.contact-name { font-size: 12px; }
	.contact-email, .muted { margin-top: 2px; color: var(--color-text-muted); font-size: 11px; }
	.empty-title { margin-bottom: 8px; }
	.pagination-left, .pagination-right, .rows-per-page { display: flex; align-items: center; }
	.pagination-left { gap: 14px; }
	.pagination-right { gap: 8px; }
	.rows-per-page { gap: 6px; }
	@media (max-width: 720px) {
		.company-controls, .company-search { align-items: stretch; }
		.company-search { max-width: none; }
		.pagination { align-items: flex-start; gap: 12px; flex-direction: column; }
	}
</style>
