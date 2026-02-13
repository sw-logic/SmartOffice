<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { saveListState, restoreListState } from '$lib/utils/list-state';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import * as Card from '$lib/components/ui/card';
	import { ListSearch, SortableHeader, ListPagination, DeleteConfirmDialog, BulkDeleteButton } from '$lib/components/shared/list';
	import {
		Plus,
		Trash2,
		Pencil,
		Eye,
		FileText,
		Hash,
		DollarSign
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';
	import { createCurrencyFormatter } from '$lib/utils/currency';

	let { data } = $props();

	const fmt = createCurrencyFormatter(data.enums.currency);

	// Persist/restore list view state
	const LIST_ROUTE = '/offers';
	let _stateRestored = false;
	$effect(() => {
		if (!browser) return;
		if (!_stateRestored) {
			_stateRestored = true;
			if (!$page.url.search) {
				const saved = restoreListState(LIST_ROUTE);
				if (saved) {
					goto(LIST_ROUTE + saved, { replaceState: true });
					return;
				}
			}
		}
		saveListState(LIST_ROUTE, $page.url.search);
	});

	let deleteDialogOpen = $state(false);
	let offerToDelete = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);

	// Bulk selection
	let selectedIds = $state<Set<number>>(new Set());
	let isBulkDeleting = $state(false);

	let allSelected = $derived(data.offers.length > 0 && selectedIds.size === data.offers.length);
	let someSelected = $derived(selectedIds.size > 0 && selectedIds.size < data.offers.length);

	function toggleSelectAll() {
		if (allSelected) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(data.offers.map((o) => o.id));
		}
	}

	function toggleSelect(id: number) {
		const next = new Set(selectedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selectedIds = next;
	}

	async function handleBulkDelete() {
		if (selectedIds.size === 0) return;
		isBulkDeleting = true;

		const formData = new FormData();
		formData.append('ids', Array.from(selectedIds).join(','));

		const response = await fetch('?/bulkDelete', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.success(`${selectedIds.size} offer(s) deleted successfully`);
			selectedIds = new Set();
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete offers');
		}

		isBulkDeleting = false;
	}

	function updateFilter(key: string, value: string) {
		const params = new URLSearchParams($page.url.searchParams);
		if (value) {
			params.set(key, value);
		} else {
			params.delete(key);
		}
		if (key !== 'page') {
			params.delete('page');
		}
		goto(`?${params.toString()}`);
	}

	function confirmDelete(offer: { id: number; offerNumber: string }) {
		offerToDelete = { id: offer.id, name: offer.offerNumber };
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!offerToDelete) return;

		isDeleting = true;
		const formData = new FormData();
		formData.append('id', String(offerToDelete.id));

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Offer deleted successfully');
			selectedIds = new Set();
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete offer');
		}

		isDeleting = false;
		deleteDialogOpen = false;
		offerToDelete = null;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Offers</h1>
			<p class="text-muted-foreground">Create and manage offers for clients</p>
		</div>
		<div class="flex items-center gap-4">
			<BulkDeleteButton
				count={selectedIds.size}
				noun="offer"
				isDeleting={isBulkDeleting}
				onconfirm={handleBulkDelete}
			/>
			<Button onclick={() => goto('/offers/new')}>
				<Plus class="mr-2 h-4 w-4" />
				New Offer
			</Button>
		</div>
	</div>

	<!-- Summary Cards -->
	<div class="grid gap-4 md:grid-cols-3">
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Value</Card.Title>
				<DollarSign class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{fmt.format(data.summary.totalAmount)}</div>
				<p class="text-muted-foreground text-xs">All matching offers</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Offers</Card.Title>
				<Hash class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{data.summary.count}</div>
				<p class="text-muted-foreground text-xs">Total offers</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Average</Card.Title>
				<FileText class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">
					{fmt.format(data.summary.count > 0 ? data.summary.totalAmount / data.summary.count : 0)}
				</div>
				<p class="text-muted-foreground text-xs">Per offer</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-4">
		<ListSearch placeholder="Search offers..." />

		<Select.Root
			type="single"
			value={data.filters.status}
			onValueChange={(v) => updateFilter('status', v)}
		>
			<Select.Trigger class="w-32">
				{data.enums.offer_status?.find((o: any) => o.value === data.filters.status)?.label || 'All Status'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All Status</Select.Item>
				{#each data.enums.offer_status || [] as option}
					<Select.Item value={option.value}>{option.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Select.Root
			type="single"
			value={data.filters.clientId}
			onValueChange={(v) => updateFilter('clientId', v)}
		>
			<Select.Trigger class="w-40">
				{data.clients.find((c: any) => String(c.id) === data.filters.clientId)?.name || 'All Clients'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All Clients</Select.Item>
				{#each data.clients as client}
					<Select.Item value={String(client.id)}>{client.name}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	<!-- Table -->
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[40px]">
						<Checkbox
							checked={allSelected}
							indeterminate={someSelected}
							onCheckedChange={toggleSelectAll}
						/>
					</Table.Head>
					<SortableHeader column="offerNumber" label="Offer #" defaultOrder="desc" />
					<SortableHeader column="title" label="Title" defaultOrder="desc" />
					<SortableHeader column="date" label="Date" defaultOrder="desc" />
					<Table.Head>Client</Table.Head>
					<Table.Head>Status</Table.Head>
					<Table.Head class="text-center">Options</Table.Head>
					<SortableHeader column="validUntil" label="Valid Until" defaultOrder="desc" />
					<SortableHeader column="grandTotal" label="Grand Total" defaultOrder="desc" class="text-right" />
					<Table.Head class="w-[100px]">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.offers as offer}
					<Table.Row
						class="cursor-pointer hover:bg-muted/50"
						onclick={() => goto(`/offers/${offer.id}`)}
					>
						<Table.Cell onclick={(e) => e.stopPropagation()}>
							<Checkbox
								checked={selectedIds.has(offer.id)}
								onCheckedChange={() => toggleSelect(offer.id)}
							/>
						</Table.Cell>
						<Table.Cell class="font-medium">{offer.offerNumber}</Table.Cell>
						<Table.Cell>
							{#if offer.title}
								{offer.title}
							{:else}
								<span class="text-muted-foreground">-</span>
							{/if}
						</Table.Cell>
						<Table.Cell>{formatDate(offer.date)}</Table.Cell>
						<Table.Cell>
							{#if offer.client}
								{offer.client.name}
							{:else if offer.clientName}
								<span class="text-muted-foreground">{offer.clientName}</span>
							{:else}
								<span class="text-muted-foreground">-</span>
							{/if}
						</Table.Cell>
						<Table.Cell>
							<EnumBadge enums={data.enums.offer_status} value={offer.status} />
						</Table.Cell>
						<Table.Cell class="text-center">{offer._count.options}</Table.Cell>
						<Table.Cell>{formatDate(offer.validUntil)}</Table.Cell>
						<Table.Cell class="text-right font-medium">
							{fmt.format(offer.grandTotal, offer.currency)}
						</Table.Cell>
						<Table.Cell>
							<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => goto(`/offers/${offer.id}`)}
									title="View offer"
								>
									<Eye class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => goto(`/offers/${offer.id}/edit`)}
									title="Edit offer"
								>
									<Pencil class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => confirmDelete({ id: offer.id, offerNumber: offer.offerNumber })}
									title="Delete offer"
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={10} class="py-8 text-center">
							<div class="text-muted-foreground">No offers found</div>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>

	<ListPagination pagination={{ page: data.page, limit: data.pageSize, total: data.totalCount, totalPages: data.totalPages }} noun="offers" />
</div>

<DeleteConfirmDialog
	bind:open={deleteDialogOpen}
	title="Delete Offer"
	name={offerToDelete?.name}
	{isDeleting}
	onconfirm={handleDelete}
/>
