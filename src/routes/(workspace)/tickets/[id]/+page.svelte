<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick, untrack } from 'svelte';
	import type { ActionData, PageData } from './$types';
	import SlaCountdown from '$lib/components/SlaCountdown.svelte';
	import TicketNumber from '$lib/components/TicketNumber.svelte';
	import TicketWorkspaceEditor from '$lib/components/TicketWorkspaceEditor.svelte';
	import TimeEntryTimeline from '$lib/components/TimeEntryTimeline.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { BILLING_MODEL_LABELS, formatCentsForInput } from '$lib/contracts';
	import { calculateBillableMinutes } from '$lib/timeEntryBilling';
	import { formatBytes } from '$lib/attachmentPolicy';
	import type { TicketWorkspaceWidgetId } from '$lib/ticketWorkspace';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let customize = $state(false);
	let editingTicket = $state(false);
	let editingWidget = $state<'customer' | 'classification' | null>(null);
	let noteComposerOpen = $state(false);
	let attachmentComposerOpen = $state(false);
	$effect(() => {
		if (form && 'keepAttachmentComposerOpen' in form && form.keepAttachmentComposerOpen)
			attachmentComposerOpen = true;
	});
	// svelte-ignore state_referenced_locally
	let logTimeOpen = $state(Boolean(form?.keepTimeModalOpen));
	// svelte-ignore state_referenced_locally
	let timeWorkDate = $state(data.defaultTimeEntry.workDate);
	// svelte-ignore state_referenced_locally
	let timeStart = $state(data.defaultTimeEntry.startTime);
	// svelte-ignore state_referenced_locally
	let timeEnd = $state(data.defaultTimeEntry.endTime);
	let endsNextDay = $state(false);
	let startTimePicker = $state<HTMLInputElement>();
	let endTimePicker = $state<HTMLInputElement>();
	let offsetDirection = $state<-1 | 1>(-1);
	let offsetHours = $state(0);
	let offsetMinutes = $state(0);
	// svelte-ignore state_referenced_locally
	let selectedWorkTypeId = $state(data.workTypes.find((item) => item.isDefault)?.id ?? data.workTypes[0]?.id ?? '');
	// svelte-ignore state_referenced_locally
	let selectedResourceRoleId = $state(data.resourceRoles.find((item) => item.isDefault)?.id ?? data.resourceRoles[0]?.id ?? '');
	let assignmentSaving = $state(false);
	let assignmentSaved = $state(false);
	let selectedCompanyId = $state(untrack(() => data.ticket.companyId));
	let selectedIssueTypeId = $state(untrack(() => data.ticket.issueTypeId ?? ''));
	// svelte-ignore state_referenced_locally
	let selectedContractId = $state(data.ticket.contractId ?? '');
	let priorityChoice = $state<'critical' | 'high' | 'medium' | 'low' | ''>('');
	let availableContacts = $derived(data.contacts.filter((contact) => contact.companyId === selectedCompanyId));
	let availableSubTypes = $derived(data.subIssueTypes.filter((type) => type.issueTypeId === selectedIssueTypeId));
	let availableContracts = $derived(data.contracts.filter((contract) => contract.companyId === selectedCompanyId));
	let currentTicketContract = $derived(data.contracts.find((contract) => contract.id === data.ticket.contractId));
	let calculatedMinutes = $derived.by(() => {
		const [startHour, startMinute] = timeStart.split(':').map(Number);
		const [endHour, endMinute] = timeEnd.split(':').map(Number);
		if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
		return endHour * 60 + endMinute + (endsNextDay ? 1440 : 0) - (startHour * 60 + startMinute);
	});
	let billingOffsetMinutes = $derived(
		offsetDirection * (Math.max(0, Number(offsetHours) || 0) * 60 + Math.max(0, Number(offsetMinutes) || 0))
	);
	let selectedWorkType = $derived(data.workTypes.find((item) => item.id === selectedWorkTypeId));
	let effectiveOffsetMinutes = $derived(data.timeSettings.allowBillingOffset ? billingOffsetMinutes : 0);
	let minutesToBill = $derived(
		selectedWorkType?.billableByDefault
			? calculateBillableMinutes(calculatedMinutes, effectiveOffsetMinutes, {
					minimumBillableMinutes: selectedWorkType.minimumBillableMinutes,
					roundingMinutes: selectedWorkType.roundingMinutes ?? data.timeSettings.billingRoundingMinutes
				})
			: 0
	);
	let workedMinutes = $derived(data.timeEntries.reduce((total, entry) => total + entry.durationMinutes, 0));
	let remainingMinutes = $derived(
		data.ticket.estimatedMinutes == null ? null : Math.max(0, data.ticket.estimatedMinutes - workedMinutes)
	);
	let activityItems = $derived(
		[
			...data.notes.map((note) => ({ kind: 'note' as const, ...note })),
			...data.attachments.map((attachment) => ({ kind: 'attachment' as const, ...attachment }))
		].sort((a, b) => b.createdAt - a.createdAt)
	);

	function changeCompany(companyId: string) {
		selectedCompanyId = companyId;
		selectedContractId = data.contracts.find((contract) => contract.companyId === companyId && contract.isDefault)?.id ?? '';
	}

	async function openInlineEditor(widget: 'customer' | 'classification', fieldId: string) {
		editingWidget = widget;
		await tick();
		const field = document.getElementById(fieldId);
		field?.focus({ preventScroll: true });
	}

	function assignmentEnhance() {
		assignmentSaving = true;
		assignmentSaved = false;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			assignmentSaving = false;
			assignmentSaved = true;
			setTimeout(() => (assignmentSaved = false), 1800);
		};
	}

	function billingContext(entry: PageData['timeEntries'][number]): string {
		const offset = entry.billingOffsetMinutes
			? ` · ${entry.billingOffsetMinutes > 0 ? '+' : ''}${entry.billingOffsetMinutes}m offset`
			: '';
		if (!entry.contractBillingModel) return offset ? offset.slice(3) : '—';
		const label = BILLING_MODEL_LABELS[entry.contractBillingModel];
		if (entry.contractBillingModel === 'fixed_fee' || entry.contractRateCents == null) return label + offset;
		const rate = `$${formatCentsForInput(entry.contractRateCents)}/hr`;
		return (entry.contractBillingModel === 'included_hours' ? `${label} · ${rate} overage` : `${label} · ${rate}`) + offset;
	}

	const statusLabels: Record<string, string> = {
		triage: 'Triage', new: 'New', in_progress: 'In Progress',
		waiting_on_client: 'Waiting on Client', waiting_on_vendor: 'Waiting on Vendor',
		resolved: 'Resolved', closed: 'Closed'
	};
	const statusActionLabels: Record<string, string> = {
		in_progress: 'Start Work', waiting_on_client: 'Wait on Client',
		waiting_on_vendor: 'Wait on Vendor', resolved: 'Resolve', closed: 'Close'
	};
</script>

<svelte:head><title>{data.ticket.ticketNumber} — Keep</title></svelte:head>

{#snippet widget(id: TicketWorkspaceWidgetId)}
	{#if id === 'customer'}
		<section class="workspace-widget editable-widget">
			<h2><button type="button" onclick={() => openInlineEditor('customer', 'inlineCompanyId')}>Customer & Contract</button></h2>
			{#if editingWidget === 'customer' || editingTicket}
				<form method="POST" action="?/updateHeader" class="inline-widget-form">
					<input type="hidden" name="title" value={data.ticket.title} />
					<input type="hidden" name="description" value={data.ticket.description ?? ''} />
					<input type="hidden" name="estimatedMinutes" value={data.ticket.estimatedMinutes ?? ''} />
					<input type="hidden" name="issueTypeId" value={selectedIssueTypeId} />
					<input type="hidden" name="subIssueTypeId" value={data.ticket.subIssueTypeId ?? ''} />
					<div class="field"><label for="inlineCompanyId">Company</label><select id="inlineCompanyId" name="companyId" value={selectedCompanyId} onchange={(event) => changeCompany((event.currentTarget as HTMLSelectElement).value)}>{#each data.companies as company}<option value={company.id}>{company.name}</option>{/each}</select></div>
					<div class="field"><label for="inlineContactId">Contact</label><select id="inlineContactId" name="contactId"><option value="">—</option>{#each availableContacts as contact}<option value={contact.id} selected={contact.id === data.ticket.contactId}>{contact.name}</option>{/each}</select></div>
					<div class="field"><label for="inlineContractId">Contract</label><select id="inlineContractId" name="contractId" bind:value={selectedContractId}><option value="">No contract</option>{#each availableContracts as contract}<option value={contract.id}>{contract.name}{contract.isDefault ? ' (Default)' : ''}</option>{/each}</select></div>
					<div class="inline-widget-actions">{#if !editingTicket}<button class="btn btn-ghost btn-sm" type="button" onclick={() => (editingWidget = null)}>Cancel</button>{/if}<button class="btn btn-primary btn-sm" type="submit">Save</button></div>
				</form>
			{:else}
				<div class="summary-list">
					<button class="summary-edit-row" type="button" onclick={() => openInlineEditor('customer', 'inlineCompanyId')}><span>Company</span><strong>{data.company?.name ?? '—'}</strong></button>
					<button class="summary-edit-row" type="button" onclick={() => openInlineEditor('customer', 'inlineContactId')}><span>Contact</span><strong>{data.contact?.name ?? '—'}</strong></button>
					<button class="summary-edit-row" type="button" onclick={() => openInlineEditor('customer', 'inlineContractId')}><span>Contract</span><strong>{data.contracts.find((contract) => contract.id === data.ticket.contractId)?.name ?? 'No contract'}</strong></button>
				</div>
			{/if}
		</section>
	{:else if id === 'assignment'}
		<section class="workspace-widget">
			<h2>Assignment</h2>
			<form method="POST" action="?/assign" use:enhance={assignmentEnhance}>
				<div class="field"><label for="resourceId">Assigned to</label><select id="resourceId" name="resourceId" onchange={(event) => event.currentTarget.form?.requestSubmit()}><option value="">Unassigned</option>{#each data.users as user}<option value={user.id} selected={user.id === data.ticket.assignedResourceId}>{user.displayName ?? user.email}</option>{/each}</select></div>
				<div class="autosave-state" aria-live="polite">{assignmentSaving ? 'Saving…' : assignmentSaved ? 'Saved' : 'Changes save automatically'}</div>
			</form>
			<form method="POST" action="?/selfAssign" use:enhance><button class="btn btn-primary btn-sm full-button" type="submit">Assign to me</button></form>
		</section>
	{:else if id === 'classification'}
		<section class="workspace-widget editable-widget">
			<h2><button type="button" onclick={() => openInlineEditor('classification', 'inlineIssueTypeId')}>Classification</button></h2>
			{#if editingWidget === 'classification' || editingTicket}
				<form method="POST" action="?/updateHeader" class="inline-widget-form">
					<input type="hidden" name="title" value={data.ticket.title} />
					<input type="hidden" name="description" value={data.ticket.description ?? ''} />
					<input type="hidden" name="estimatedMinutes" value={data.ticket.estimatedMinutes ?? ''} />
					<input type="hidden" name="companyId" value={selectedCompanyId} />
					<input type="hidden" name="contactId" value={data.ticket.contactId ?? ''} />
					<input type="hidden" name="contractId" value={selectedContractId} />
					<div class="field"><label for="inlineIssueTypeId">Issue Type</label><select id="inlineIssueTypeId" name="issueTypeId" bind:value={selectedIssueTypeId}><option value="">—</option>{#each data.issueTypes as type}<option value={type.id}>{type.name}</option>{/each}</select></div>
					<div class="field"><label for="inlineSubIssueTypeId">Sub-Issue Type</label><select id="inlineSubIssueTypeId" name="subIssueTypeId"><option value="">—</option>{#each availableSubTypes as type}<option value={type.id} selected={type.id === data.ticket.subIssueTypeId}>{type.name}</option>{/each}</select></div>
					<p class="widget-meta">Queue will be recalculated when saved.</p>
					<div class="inline-widget-actions">{#if !editingTicket}<button class="btn btn-ghost btn-sm" type="button" onclick={() => (editingWidget = null)}>Cancel</button>{/if}<button class="btn btn-primary btn-sm" type="submit">Save</button></div>
				</form>
			{:else}
				<div class="summary-list">
					<button class="summary-edit-row" type="button" onclick={() => openInlineEditor('classification', 'inlineIssueTypeId')}><span>Issue Type</span><strong>{data.issueType?.name ?? '—'}</strong></button>
					<button class="summary-edit-row" type="button" onclick={() => openInlineEditor('classification', 'inlineSubIssueTypeId')}><span>Sub-Issue Type</span><strong>{data.subIssueType?.name ?? '—'}</strong></button>
					<button class="summary-edit-row" type="button" onclick={() => openInlineEditor('classification', 'inlineIssueTypeId')}><span>Queue</span><strong>{data.queue?.name ?? '—'}</strong></button>
				</div>
			{/if}
		</section>
	{:else if id === 'details'}
		<section class="workspace-widget">
			<h2>Ticket Details</h2>
			{#if editingTicket}
				<form method="POST" action="?/updateHeader" class="inline-widget-form">
					<input type="hidden" name="companyId" value={selectedCompanyId} />
					<input type="hidden" name="contactId" value={data.ticket.contactId ?? ''} />
					<input type="hidden" name="contractId" value={selectedContractId} />
					<input type="hidden" name="issueTypeId" value={selectedIssueTypeId} />
					<input type="hidden" name="subIssueTypeId" value={data.ticket.subIssueTypeId ?? ''} />
					<div class="field"><label for="inlineTitle">Title</label><input id="inlineTitle" name="title" type="text" value={data.ticket.title} required /></div>
					<div class="field"><label for="inlineDescription">Description</label><textarea id="inlineDescription" name="description" rows="5">{data.ticket.description ?? ''}</textarea></div>
					<div class="field"><label for="inlineEstimatedMinutes">Estimated work (minutes)</label><input id="inlineEstimatedMinutes" name="estimatedMinutes" type="number" min="0" step="15" value={data.ticket.estimatedMinutes ?? ''} placeholder="Optional" /></div>
					<div class="inline-widget-actions"><button class="btn btn-primary btn-sm" type="submit">Save</button></div>
				</form>
			{:else}
				<div class="description">{data.ticket.description ?? 'No description provided.'}</div>
			{/if}
		</section>
	{:else if id === 'activity'}
		<section class="workspace-widget activity-widget">
			<div class="widget-heading"><h2>Activity <span class="row-count-badge">{activityItems.length}</span></h2><div class="quick-add-actions"><button class="btn btn-ghost btn-sm" type="button" onclick={() => (noteComposerOpen = !noteComposerOpen)}>+ New Note</button><button class="btn btn-ghost btn-sm" type="button" onclick={() => (attachmentComposerOpen = !attachmentComposerOpen)}><Icon name="paperclip" class="btn-icon" /> New Attachment</button><button class="btn btn-primary btn-sm" type="button" onclick={() => (logTimeOpen = true)}>+ New Time Entry</button></div></div>
			{#if noteComposerOpen}
				<form method="POST" action="?/addNote" use:enhance class="composer">
					<div class="field"><label for="body">Add a note</label><textarea id="body" name="body" rows="3" required></textarea></div>
					<div class="button-row"><label class="check-row"><input type="checkbox" name="internal" checked /> Internal note</label><button class="btn btn-ghost btn-sm" type="button" onclick={() => (noteComposerOpen = false)}>Cancel</button><button class="btn btn-primary btn-sm" type="submit">Add Note</button></div>
				</form>
			{/if}
			{#if attachmentComposerOpen}
				<form method="POST" action="?/addAttachment" enctype="multipart/form-data" class="composer attachment-composer">
					<div class="field"><label for="attachmentFile">Choose file</label><input id="attachmentFile" name="file" type="file" required /></div>
					<div class="button-row"><label class="check-row"><input type="checkbox" name="internal" checked /> Internal attachment</label><button class="btn btn-ghost btn-sm" type="button" onclick={() => (attachmentComposerOpen = false)}>Cancel</button><button class="btn btn-primary btn-sm" type="submit">Upload</button></div>
				</form>
			{/if}
			<div class="activity-list">
				{#each activityItems as item}
					{#if item.kind === 'note'}
						<article class="activity-item">
							<div class="activity-meta"><strong>{item.resourceName ?? item.resourceEmail}</strong><span class="badge" class:badge-info={item.visibility === 'client_visible'} class:badge-muted={item.visibility === 'internal'}>{item.visibility === 'client_visible' ? 'Client-Visible' : 'Internal'}</span><time>{new Date(item.createdAt * 1000).toLocaleString()}</time></div>
							<div class="note-body">{item.body}</div>
						</article>
					{:else}
						<article class="activity-item attachment-item">
							<div class="activity-meta"><strong>{item.uploaderName ?? item.uploaderEmail}</strong><span class="badge" class:badge-info={item.visibility === 'client_visible'} class:badge-muted={item.visibility === 'internal'}>{item.visibility === 'client_visible' ? 'Client-Visible' : 'Internal'}</span><time>{new Date(item.createdAt * 1000).toLocaleString()}</time></div>
							<div class="attachment-row"><Icon name="paperclip" class="attachment-icon" /><div><a href={`/tickets/${data.ticket.id}/attachments/${item.id}`}>{item.fileName}</a><span>{formatBytes(item.sizeBytes)} · {item.contentType}</span></div>{#if item.uploaderId === data.user.id || data.user.role === 'admin'}<form method="POST" action="?/deleteAttachment"><input type="hidden" name="attachmentId" value={item.id} /><button class="btn btn-danger btn-sm" type="submit">Delete</button></form>{/if}</div>
						</article>
					{/if}
				{:else}<div class="empty">No activity yet.</div>{/each}
			</div>
		</section>
	{:else if id === 'time-history'}
		<section class="workspace-widget">
			<h2>Time Entry History <span class="row-count-badge">{data.timeEntries.length}</span></h2>
			<div class="table-scroll"><table><thead><tr><th>Date</th><th>Start–End</th><th>Tech</th><th>Work Type / Role</th><th>Worked</th><th>Billable</th><th>Work Performed</th><th>Contract</th><th>Billing</th><th></th></tr></thead><tbody>
				{#each data.timeEntries as entry}<tr><td>{new Date(entry.workDate * 1000).toLocaleDateString(undefined, { timeZone: 'UTC' })}</td><td>{entry.startAt && entry.endAt ? `${new Date(entry.startAt * 1000).toLocaleTimeString([], { timeZone: data.organizationTimezone, hour: 'numeric', minute: '2-digit' })}–${new Date(entry.endAt * 1000).toLocaleTimeString([], { timeZone: data.organizationTimezone, hour: 'numeric', minute: '2-digit' })}` : '—'}</td><td>{entry.resourceName ?? entry.resourceEmail}</td><td>{entry.workTypeName ?? '—'}<div class="internal-time-note">{entry.resourceRoleName ?? '—'}</div></td><td>{entry.durationMinutes} min</td><td>{entry.billableMinutes ?? entry.durationMinutes} min</td><td>{entry.notes ?? '—'}{#if entry.internalNotes}<div class="internal-time-note">Internal: {entry.internalNotes}</div>{/if}</td><td>{entry.contractName ?? 'No contract'}</td><td>{billingContext(entry)}</td><td><form method="POST" action="?/deleteTimeEntry" use:enhance><input type="hidden" name="entryId" value={entry.id} /><button class="btn btn-danger btn-sm" type="submit">Delete</button></form></td></tr>
				{:else}<tr><td colspan="10" class="empty">No time entries yet.</td></tr>{/each}
			</tbody></table></div>
		</section>
	{:else if id === 'status-sla'}
		<section class="workspace-widget">
			<h2>Status & SLA</h2>
			<div class="status-line"><span class="badge badge-muted">{statusLabels[data.ticket.status]}</span>{#if data.ticket.needsTechAttention}<span class="badge badge-warning">Needs Attention</span>{/if}</div>
			<div class="sla-stack">
				{#if data.ticket.status === 'triage'}<SlaCountdown label="Triage due" startedAt={data.ticket.createdAt} dueAt={data.ticket.triageDueAt} />
				{:else}<SlaCountdown label="Response due" startedAt={data.ticket.slaClockStartedAt} dueAt={data.ticket.responseDueAt} /><SlaCountdown label="Resolution due" startedAt={data.ticket.slaClockStartedAt} dueAt={data.ticket.resolutionDueAt} />{/if}
			</div>
			{#if data.ticket.status === 'triage'}
				<form method="POST" action="?/triage" use:enhance><div class="field"><label for="priority">Priority</label><select id="priority" name="priority" bind:value={priorityChoice}><option value="">Select…</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div><button class="btn btn-primary btn-sm full-button" type="submit" disabled={!priorityChoice}>Leave Triage</button></form>
			{:else}
				<div class="status-actions">{#each data.nextStatuses as status}<form method="POST" action="?/setStatus" use:enhance><input type="hidden" name="status" value={status} /><button class="btn btn-ghost btn-sm" type="submit">{statusActionLabels[status] ?? status}</button></form>{/each}<form method="POST" action="?/clientReply" use:enhance><button class="btn btn-ghost btn-sm" type="submit">Client Replied</button></form></div>
			{/if}
		</section>
	{:else if id === 'log-time'}
		<section class="workspace-widget">
			<h2>Time Summary</h2>
			<div class="time-summary-grid">
				<div><span>Worked</span><strong>{Math.floor(workedMinutes / 60)}h {workedMinutes % 60}m</strong></div>
				<div><span>Estimated</span><strong>{data.ticket.estimatedMinutes == null ? '—' : `${Math.floor(data.ticket.estimatedMinutes / 60)}h ${data.ticket.estimatedMinutes % 60}m`}</strong></div>
				<div><span>Remaining</span><strong>{remainingMinutes == null ? '—' : `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m`}</strong></div>
			</div>
		</section>
	{/if}
{/snippet}

<div class="ticket-page">
	<div class="pf-crumb">Ticket / <TicketNumber value={data.ticket.ticketNumber} /></div>
	<div class="pf-topbar">
		<div><h1>{data.ticket.title}</h1><div class="ticket-subtitle">{data.company?.name}</div></div>
		<div class="header-actions">
			<button class="btn btn-sm" class:btn-primary={editingTicket} class:btn-ghost={!editingTicket} type="button" onclick={() => { editingWidget = null; editingTicket = !editingTicket; }}>{editingTicket ? 'Done Editing' : 'Edit Ticket'}</button>
			<button class="btn btn-sm" class:btn-primary={customize} class:btn-ghost={!customize} type="button" onclick={() => (customize = !customize)}>{customize ? 'Done' : 'Customize Layout'}</button>
		</div>
	</div>

	{#if form?.error}<div class="error-banner">{form.error}</div>{/if}
	{#if form?.workspaceSaved}<div class="success-message">Personal workspace saved.</div>{/if}
	{#if form?.workspaceReset}<div class="success-message">Now following the organization default.</div>{/if}

	{#if customize}
		<div class="customizer">
			<div class="customizer-head"><div><strong>Personal workspace</strong><p>{data.hasPersonalWorkspace ? 'You have a personal override.' : 'You currently follow the organization default.'}</p></div>{#if data.hasPersonalWorkspace}<form method="POST" action="?/resetWorkspace"><button class="btn btn-ghost btn-sm" type="submit">Use Organization Default</button></form>{/if}</div>
			<TicketWorkspaceEditor initial={data.workspaceLayout} action="?/saveWorkspace" submitLabel="Save Personal Layout" />
		</div>
	{/if}

	{#if logTimeOpen}
		<div class="modal-backdrop" role="presentation" onclick={(event) => event.target === event.currentTarget && (logTimeOpen = false)}>
			<div class="modal time-entry-modal" role="dialog" aria-modal="true" aria-labelledby="logTimeTitle">
				<div class="modal-header time-modal-header" id="logTimeTitle"><div><strong>Add Time Entry</strong><span><TicketNumber value={data.ticket.ticketNumber} /> · {data.ticket.title}</span></div><button class="modal-close" type="button" onclick={() => (logTimeOpen = false)} aria-label="Close">×</button></div>
				<form method="POST" action="?/addTimeEntry">
					<div class="modal-body time-modal-body">
						<section class="time-form-section billing-context">
							<h3>Billing</h3>
							<div class="billing-grid">
								<div><span>Contract</span><strong>{currentTicketContract?.name ?? 'No contract'}</strong></div>
								<div><span>Billing model</span><strong>{currentTicketContract?.billingModel ? BILLING_MODEL_LABELS[currentTicketContract.billingModel] : 'No contract'}</strong></div>
								<div><span>Billing treatment</span><strong>{selectedWorkType?.billableByDefault ? 'Billable' : 'Non-billable'}</strong></div>
							</div>
							{#if selectedWorkType?.billableByDefault}<input type="hidden" name="billable" value="on" />{/if}
							<p class="section-help">Contract and rate context are snapshotted when this entry is saved.</p>
						</section>

						<section class="time-form-section time-details-section">
							<h3>Time Entry Details</h3>
							<TimeEntryTimeline
								bind:date={timeWorkDate}
								bind:startTime={timeStart}
								bind:endTime={timeEnd}
								bind:endsNextDay
								timezone={data.organizationTimezone}
								entries={data.timeEntries}
								businessStartMinute={data.timeSettings.businessStartMinute}
								businessEndMinute={data.timeSettings.businessEndMinute}
								incrementMinutes={data.timeSettings.timeEntryIncrementMinutes}
							/>
							<input type="hidden" name="workDate" value={timeWorkDate} />
							<div class="time-fields">
								<div class="field"><label for="startTime">Start time</label><input class="picker-input" bind:this={startTimePicker} id="startTime" name="startTime" type="time" step={data.timeSettings.timeEntryIncrementMinutes * 60} bind:value={timeStart} onclick={() => startTimePicker?.showPicker?.()} required /></div>
								<div class="field"><label for="endTime">End time</label><input class="picker-input" bind:this={endTimePicker} id="endTime" name="endTime" type="time" step={data.timeSettings.timeEntryIncrementMinutes * 60} bind:value={timeEnd} onclick={() => endTimePicker?.showPicker?.()} required /></div>
								<div class="field"><span class="field-label">Time worked</span><div class="read-field duration" class:invalid={calculatedMinutes <= 0 || calculatedMinutes > 1440}>{calculatedMinutes > 0 ? `${Math.floor(calculatedMinutes / 60)}h ${calculatedMinutes % 60}m` : 'Check times'}</div></div>
								<label class="check-row overnight"><input type="checkbox" name="endsNextDay" bind:checked={endsNextDay} /> Ends next day</label>
							</div>
							<p class="section-help">Times use the organization timezone: {data.organizationTimezone}.</p>
							<div class="time-rule-fields">
								<div class="field"><label for="workTypeId">Work Type</label><select id="workTypeId" name="workTypeId" bind:value={selectedWorkTypeId} required>{#each data.workTypes as item}<option value={item.id}>{item.name}</option>{/each}</select></div>
								<div class="field"><label for="resourceRoleId">Resource Role</label><select id="resourceRoleId" name="resourceRoleId" bind:value={selectedResourceRoleId} required>{#each data.resourceRoles as item}<option value={item.id}>{item.name}</option>{/each}</select></div>
							</div>
							<div class="timeline-billing">
								{#if data.timeSettings.allowBillingOffset}<div class="offset-control">
									<span>Billing offset</span>
									<div class="offset-entry">
										<button class:active={offsetDirection === -1} type="button" onclick={() => (offsetDirection = -1)} aria-label="Subtract billing offset">−</button>
										<button class:active={offsetDirection === 1} type="button" onclick={() => (offsetDirection = 1)} aria-label="Add billing offset">+</button>
										<label><input type="number" min="0" max="23" step="1" bind:value={offsetHours} aria-label="Billing offset hours" /><span>h</span></label>
										<label><input type="number" min="0" max="59" step="5" bind:value={offsetMinutes} aria-label="Billing offset minutes" /><span>m</span></label>
									</div>
								</div>{/if}
								<div class="hours-to-bill"><span>Hours to bill</span><strong>{Math.floor(minutesToBill / 60)}h {minutesToBill % 60}m</strong></div>
							</div>
							<input type="hidden" name="billingOffsetMinutes" value={effectiveOffsetMinutes} />
							<div class="field summary-notes"><label for="teNotes">Summary notes <span class="required">Required</span></label><textarea id="teNotes" name="notes" rows="5" placeholder="Describe the work performed. This may be customer-facing." required></textarea></div>
							<div class="field"><label for="internalNotes">Internal notes</label><textarea id="internalNotes" name="internalNotes" rows="3" placeholder="Diagnostic or operational detail that customers should not see"></textarea></div>
						</section>

						{#if data.nextStatuses.length}
							<section class="time-form-section">
								<h3>Ticket Workflow</h3>
								<div class="field status-picker"><label for="ticketStatus">Update ticket status</label><select id="ticketStatus" name="ticketStatus"><option value="">No change · {statusLabels[data.ticket.status]}</option>{#each data.nextStatuses as status}<option value={status}>{statusLabels[status]}</option>{/each}</select></div>
							</section>
						{/if}
					</div>
					<div class="modal-footer"><button class="btn btn-ghost" type="button" onclick={() => (logTimeOpen = false)}>Cancel</button><button class="btn btn-ghost" type="submit" name="saveMode" value="new">Save & New</button><button class="btn btn-primary" type="submit" name="saveMode" value="close">Save & Close</button></div>
				</form>
			</div>
		</div>
	{/if}

	<div class="workspace-grid preset-{data.workspaceLayout.preset}">
		{#each ['left', 'center', 'right'] as column}
			<div class="workspace-column">
				{#each data.workspaceLayout.columns[column as keyof typeof data.workspaceLayout.columns] as id (id)}
					{@render widget(id)}
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.ticket-page { width:100%; max-width:1500px; margin:0 auto; }
	.ticket-subtitle { margin-top:4px; color:var(--color-text-muted); font-size:12px; }
	.header-actions { display:flex; align-items:center; gap:8px; }
	.workspace-grid { display:grid; gap:14px; align-items:start; }
	.workspace-grid.preset-3-6-3 { grid-template-columns:minmax(220px,3fr) minmax(420px,6fr) minmax(220px,3fr); }
	.workspace-grid.preset-3-7-2 { grid-template-columns:minmax(220px,3fr) minmax(460px,7fr) minmax(190px,2fr); }
	.workspace-grid.preset-2-7-3 { grid-template-columns:minmax(190px,2fr) minmax(460px,7fr) minmax(220px,3fr); }
	.workspace-column { display:flex; min-width:0; flex-direction:column; gap:14px; }
	.workspace-widget { min-width:0; padding:16px; border:1px solid var(--color-border); border-radius:var(--r-card); background:var(--color-surface); box-shadow:var(--shadow-card); }
	.workspace-widget h2 { margin:0 0 14px; color:var(--color-text-primary); font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
	.editable-widget h2 button { width:100%; border:0; background:transparent; color:inherit; font:inherit; text-align:left; text-transform:inherit; letter-spacing:inherit; cursor:pointer; }
	.editable-widget h2 button:hover { color:var(--color-primary); }
	.widget-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
	.widget-heading h2 { margin:0; }
	.quick-add-actions { display:flex; gap:6px; }
	.workspace-widget textarea { width:100%; padding:8px 11px; border:1px solid var(--color-border-strong); border-radius:var(--r-btn); background:var(--color-canvas); color:var(--color-text-primary); font:inherit; resize:vertical; }
	.summary-list { display:flex; flex-direction:column; gap:11px; margin:0; }
	.summary-edit-row { display:flex; width:calc(100% + 12px); flex-direction:column; gap:3px; margin:0 -6px; padding:5px 6px; border:0; border-radius:var(--r-btn); background:transparent; color:inherit; text-align:left; cursor:pointer; }
	.summary-edit-row:hover, .summary-edit-row:focus-visible { background:var(--color-surface-raised); outline:none; }
	.summary-edit-row span { color:var(--color-text-subtle); font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; }
	.summary-edit-row strong { color:var(--color-text-primary); font-size:12px; font-weight:400; line-height:1.4; }
	.inline-widget-form .field { margin-bottom:10px; }
	.inline-widget-actions { display:flex; justify-content:flex-end; gap:6px; }
	.description { color:var(--color-text-primary); white-space:pre-wrap; font-size:13px; line-height:1.55; }
	.autosave-state { min-height:15px; margin-top:-8px; color:var(--color-text-subtle); font-size:10px; }
	.widget-meta { margin:0 0 12px; color:var(--color-text-muted); font-size:11px; }
	.button-row, .status-line, .status-actions { display:flex; align-items:center; flex-wrap:wrap; gap:7px; }
	.button-row select { flex:1; }
	.full-button { width:100%; margin-top:8px; }
	.status-line { margin-bottom:12px; }
	.status-actions { margin-top:12px; }
	.sla-stack { display:grid; gap:8px; }
	.check-row { display:flex; align-items:center; gap:7px; color:var(--color-text-muted); font-size:12px; }
	.time-summary-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; }
	.time-summary-grid div { display:flex; min-width:0; flex-direction:column; gap:4px; padding:9px; border:1px solid var(--color-border); border-radius:var(--r-btn); background:var(--color-canvas); }
	.time-summary-grid span { color:var(--color-text-subtle); font-size:9px; text-transform:uppercase; }
	.time-summary-grid strong { font-family:var(--mono); font-size:12px; }
	.time-entry-modal { width:min(920px, calc(100vw - 40px)); max-height:calc(100vh - 40px); overflow:hidden; }
	.time-modal-header { display:flex; align-items:flex-start; justify-content:space-between; }
	.time-modal-header > div { display:flex; flex-direction:column; gap:4px; }
	.time-modal-header span { color:var(--color-text-muted); font-size:11px; font-weight:400; }
	.modal-close { border:0; background:transparent; color:var(--color-text-muted); font-size:22px; cursor:pointer; }
	.time-modal-body { display:grid; max-height:calc(100vh - 165px); grid-template-columns:1fr 1fr; gap:14px; overflow-y:auto; background:var(--color-canvas); }
	.time-form-section { padding:15px; border:1px solid var(--color-border); border-radius:var(--r-btn); background:var(--color-surface); }
	.billing-context, .time-details-section { grid-column:1 / -1; }
	.time-form-section h3 { margin:0 0 14px; font-size:12px; text-transform:uppercase; letter-spacing:.05em; }
	.time-fields { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:0 12px; }
	.time-rule-fields { display:grid; grid-template-columns:1fr 1fr; gap:0 12px; margin-top:12px; }
	.read-field { min-height:34px; padding:8px 10px; border:1px solid var(--color-border); border-radius:var(--r-btn); background:var(--color-canvas); font-size:12px; }
	.picker-input { cursor:pointer; }
	.field-label { display:block; margin-bottom:5px; color:var(--color-text-muted); font-size:11px; font-weight:600; }
	.read-field.duration { font-family:var(--mono); font-weight:700; }
	.read-field.invalid { color:var(--color-danger); }
	.overnight { grid-column:1 / -1; align-self:center; margin-top:8px; }
	.section-help { margin:2px 0 0; color:var(--color-text-subtle); font-size:10px; line-height:1.4; }
	.billing-grid { display:grid; grid-template-columns:1fr 1fr auto; gap:14px; align-items:center; }
	.billing-grid > div { display:flex; flex-direction:column; gap:4px; }
	.billing-grid span { color:var(--color-text-subtle); font-size:10px; text-transform:uppercase; }
	.billing-grid strong { font-size:12px; }
	.timeline-billing { display:flex; align-items:end; gap:24px; margin:12px 0; padding:10px 12px; border:1px solid var(--color-border); border-radius:var(--r-btn); background:var(--color-canvas); }
	.offset-control, .hours-to-bill { display:flex; flex-direction:column; gap:5px; }
	.offset-control > span, .hours-to-bill > span { color:var(--color-text-subtle); font-size:9px; text-transform:uppercase; }
	.offset-entry { display:flex; align-items:center; gap:4px; }
	.offset-entry button { width:30px; height:30px; padding:0; border:1px solid var(--color-border-strong); background:var(--color-surface); color:var(--color-text-muted); font-size:16px; cursor:pointer; }
	.offset-entry button:first-child { border-radius:var(--r-btn) 0 0 var(--r-btn); }
	.offset-entry button:nth-child(2) { margin-left:-5px; border-radius:0 var(--r-btn) var(--r-btn) 0; }
	.offset-entry button.active { border-color:var(--color-accent); background:var(--color-accent); color:white; }
	.offset-entry label { position:relative; display:flex; align-items:center; }
	.offset-entry input { width:58px; padding:6px 21px 6px 7px; border:1px solid var(--color-border-strong); border-radius:var(--r-btn); outline:none; background:var(--color-canvas); color:var(--color-text-primary); }
	.offset-entry input:focus { border-color:var(--color-primary); box-shadow:0 0 0 2px rgba(65,105,225,.15); }
	.offset-entry label span { position:absolute; right:7px; color:var(--color-text-subtle); font-size:10px; pointer-events:none; }
	.hours-to-bill { min-width:100px; }
	.hours-to-bill strong { font-family:var(--mono); font-size:14px; }
	.summary-notes { margin-top:14px; }
	.required { margin-left:5px; color:var(--color-danger); font-size:9px; text-transform:uppercase; }
	.status-picker { max-width:320px; margin:0; }
	.composer { margin-bottom:6px; padding-bottom:14px; border-bottom:1px solid var(--color-border); }
	.attachment-composer input[type='file'] { padding:6px; }
	.attachment-composer input[type='file']::file-selector-button { margin-right:10px; padding:5px 10px; border:1px solid var(--color-border-strong); border-radius:var(--r-btn); background:var(--color-surface-raised); color:var(--color-text-primary); cursor:pointer; }
	.activity-item { padding:14px 0; border-bottom:1px solid var(--color-border); }
	.activity-item:last-child { border-bottom:0; }
	.activity-meta { display:flex; align-items:center; flex-wrap:wrap; gap:7px; margin-bottom:6px; font-size:11px; }
	.activity-meta time { color:var(--color-text-subtle); }
	.note-body { white-space:pre-wrap; font-size:13px; line-height:1.5; }
	.attachment-row { display:flex; align-items:center; gap:9px; }
	.attachment-row > div { display:flex; min-width:0; flex:1; flex-direction:column; gap:2px; }
	.attachment-row a { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; }
	.attachment-row span { color:var(--color-text-subtle); font-size:10px; }
	.attachment-icon { width:16px; height:16px; color:var(--color-text-muted); flex-shrink:0; }
	.table-scroll { overflow-x:auto; }
	.table-scroll table { min-width:620px; }
	.internal-time-note { margin-top:4px; color:var(--color-text-subtle); font-size:10px; font-style:italic; }
	.customizer { margin-bottom:18px; padding:16px; border:1px solid var(--color-accent); border-radius:var(--r-card); background:var(--color-surface); }
	.customizer-head { display:flex; align-items:start; justify-content:space-between; gap:16px; margin-bottom:16px; }
	.customizer-head p { margin:4px 0 0; color:var(--color-text-muted); font-size:11px; }
	.success-message { margin-bottom:16px; padding:10px 12px; border:1px solid var(--color-success); border-radius:var(--r-btn); color:var(--color-success); font-size:12px; }
	@media (max-width:1100px) {
		.workspace-grid, .workspace-grid.preset-3-6-3, .workspace-grid.preset-3-7-2, .workspace-grid.preset-2-7-3 { grid-template-columns:minmax(210px, 1fr) minmax(420px, 2fr); }
		.workspace-column:last-child { grid-column:1 / -1; display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); }
	}
	@media (max-width:760px) {
		.workspace-grid, .workspace-grid.preset-3-6-3, .workspace-grid.preset-3-7-2, .workspace-grid.preset-2-7-3 { grid-template-columns:1fr; }
		.workspace-column:last-child { grid-column:auto; display:flex; }
		.time-modal-body { grid-template-columns:1fr; }
		.time-fields { grid-template-columns:1fr; }
		.time-rule-fields { grid-template-columns:1fr; }
		.overnight { grid-column:auto; }
		.billing-context, .time-details-section { grid-column:auto; }
		.billing-grid { grid-template-columns:1fr; }
		.timeline-billing { align-items:stretch; flex-direction:column; gap:10px; }
		.widget-heading { align-items:flex-start; flex-direction:column; }
	}
</style>
