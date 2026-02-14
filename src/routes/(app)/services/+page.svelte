<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { saveListState, restoreListState } from '$lib/utils/list-state';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { ListSearch, SortableHeader, ListPagination, DeleteConfirmDialog } from '$lib/components/shared/list';
	import { Plus, Pencil, Trash2, Eye } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';
	import { createCurrencyFormatter } from '$lib/utils/currency';

	let { data } = $props();

	const fmt = createCurrencyFormatter(data.enums.currency);

	// Persist/restore list view state
	const LIST_ROUTE = '/services';
	let _stateRestored = false;
	$effect(() => {
		if (!browser) return;
		if (!_stateRestored) {
			_stateRestored = true;
			if (!$page.url.search) {
				const saved = restoreListState(LIST_ROUTE);
				if (saved) { goto(LIST_ROUTE + saved, { replaceState: true }); return; }
			}
		}
		saveListState(LIST_ROUTE, $page.url.search);
	});

	// Single delete
	let deleteDialogOpen = $state(false);
	let serviceToDelete = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);

	// Bulk delete
	let selectedIds = $state<Set<number>>(new Set());
	let bulkDeleteDialogOpen = $state(false);
	let isBulkDeleting = $state(false);

	let allSelected = $derived(data.services.length > 0 && selectedIds.size === data.services.length);
	let someSelected = $derived(selectedIds.size > 0 && selectedIds.size < data.services.length);

	function toggleSelectAll() {
		if (allSelected) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(data.services.map((s) => s.id));
		}
	}

	function toggleSelect(id: number) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function updateStatus(value: string | undefined) {
		if (!value) return;
		const url = new URL($page.url);
		if (value === 'all') {
			url.searchParams.delete('status');
		} else {
			url.searchParams.set('status', value);
		}
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true });
	}

	function confirmDelete(service: { id: number; name: string }) {
		serviceToDelete = service;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!serviceToDelete) return;
		isDeleting = true;
		const formData = new FormData();
		formData.append('id', String(serviceToDelete.id));

		const response = await fetch('?/delete', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Service deleted successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete service');
		}

		isDeleting = false;
		deleteDialogOpen = false;
		serviceToDelete = null;
	}

	async function handleBulkDelete() {
		isBulkDeleting = true;
		const formData = new FormData();
		formData.append('ids', Array.from(selectedIds).join(','));

		const response = await fetch('?/bulkDelete', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.type === 'success') {
			toast.success(`${result.data.count} service(s) deleted`);
			selectedIds = new Set();
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete services');
		}

		isBulkDeleting = false;
		bulkDeleteDialogOpen = false;
	}

	function fmtMin(m: number): string {
		const h = Math.floor(m / 60);
		const min = m % 60;
		return `${h}h ${min}m`;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Services</h1>
			<p class="text-muted-foreground">Manage monthly recurring services</p>
		</div>
		<div class="flex items-center gap-2">
			{#if selectedIds.size > 0 && data.canDelete}
				<Button variant="destructive" onclick={() => (bulkDeleteDialogOpen = true)}>
					<Trash2 class="mr-2 h-4 w-4" />
					Delete ({selectedIds.size})
				</Button>
			{/if}
			{#if data.canCreate}
				<Button href="/services/new">
					<Plus class="mr-2 h-4 w-4" />
					New Service
				</Button>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-4">
		<ListSearch placeholder="Search services..." />

		<Select.Root
			type="single"
			value={data.filters.status || 'all'}
			onValueChange={updateStatus}
		>
			<Select.Trigger class="w-[180px]">
				{data.enums.service_status?.find((o) => o.value === data.filters.status)?.label || 'All statuses'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="all">All statuses</Select.Item>
				{#each data.enums.service_status || [] as option}
					<Select.Item value={option.value}>{option.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					{#if data.canDelete}
						<Table.Head class="w-[40px]">
							<Checkbox
								checked={allSelected}
								indeterminate={someSelected}
								onCheckedChange={toggleSelectAll}
							/>
						</Table.Head>
					{/if}
					<SortableHeader column="name" label="Name" />
					<Table.Head>Client</Table.Head>
					<Table.Head>Type</Table.Head>
					<Table.Head>Status</Table.Head>
					<SortableHeader column="monthlyFee" label="Fee" />
					<Table.Head>Budget / Spent</Table.Head>
					<Table.Head>Assigned To</Table.Head>
					<Table.Head class="w-[140px]">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.services.length === 0}
					<Table.Row>
						<Table.Cell colspan={data.canDelete ? 9 : 8} class="h-24 text-center">
							No services found.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.services as service}
						<Table.Row
							class="cursor-pointer hover:bg-muted/50"
							onclick={() => goto(`/services/${service.id}`)}
						>
							{#if data.canDelete}
								<Table.Cell onclick={(e) => e.stopPropagation()}>
									<Checkbox
										checked={selectedIds.has(service.id)}
										onCheckedChange={() => toggleSelect(service.id)}
									/>
								</Table.Cell>
							{/if}
							<Table.Cell class="font-medium">{service.name}</Table.Cell>
							<Table.Cell>
								{#if service.client}
									<a
										href="/clients/{service.client.id}"
										class="text-primary hover:underline"
										onclick={(e) => e.stopPropagation()}
									>
										{service.client.name}
									</a>
								{:else if service.clientName}
									<span class="text-muted-foreground">{service.clientName}</span>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if service.type}
									{@const typeEnum = data.enums.service_type?.find((e) => e.value === service.type)}
									<Badge variant="outline">{typeEnum?.label ?? service.type}</Badge>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								<EnumBadge enums={data.enums.service_status} value={service.status} />
							</Table.Cell>
							<Table.Cell>
								{#if service.monthlyFee != null}
									{fmt.format(service.monthlyFee, service.currency)}
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if service.budgetedHours != null}
									<span class="text-sm">
										{fmtMin(service.spentTime)} / {fmtMin(service.budgetedHours)}
									</span>
								{:else if service.spentTime > 0}
									<span class="text-sm">{fmtMin(service.spentTime)}</span>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if service.assignedTo}
									{service.assignedTo.firstName ?? ''} {service.assignedTo.lastName ?? ''}
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
									<Button variant="ghost" size="icon" href="/services/{service.id}" title="View">
										<Eye class="h-4 w-4" />
									</Button>
									{#if data.canUpdate}
										<Button variant="ghost" size="icon" href="/services/{service.id}/edit" title="Edit">
											<Pencil class="h-4 w-4" />
										</Button>
									{/if}
									{#if data.canDelete}
										<Button
											variant="ghost"
											size="icon"
											onclick={() => confirmDelete({ id: service.id, name: service.name })}
											title="Delete"
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									{/if}
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	<ListPagination pagination={data.pagination} noun="services" />
</div>

<DeleteConfirmDialog
	bind:open={deleteDialogOpen}
	title="Delete Service"
	name={serviceToDelete?.name}
	{isDeleting}
	onconfirm={handleDelete}
/>

<!-- Bulk delete confirmation -->
<AlertDialog.Root bind:open={bulkDeleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Services</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to permanently delete {selectedIds.size} service(s)? This will also delete any linked recurring income records. This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<Button variant="destructive" onclick={handleBulkDelete} disabled={isBulkDeleting}>
				{isBulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} service(s)`}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
