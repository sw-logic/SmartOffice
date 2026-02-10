<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { saveListState, restoreListState } from '$lib/utils/list-state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Card from '$lib/components/ui/card';
	import {
		Plus,
		Search,
		ArrowUpDown,
		Trash2,
		Pencil,
		Eye,
		FileText,
		Hash,
		DollarSign
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

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

	let searchInput = $state(data.filters.search);
	let deleteDialogOpen = $state(false);
	let selectedOffer = $state<{ id: number; offerNumber: string } | null>(null);

	// Bulk selection
	let selectedIds = $state<Set<number>>(new Set());
	let bulkDeleteDialogOpen = $state(false);
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
		bulkDeleteDialogOpen = false;
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

	function handleSearch() {
		updateFilter('search', searchInput);
	}

	function toggleSort(column: string) {
		const params = new URLSearchParams($page.url.searchParams);
		const currentSort = params.get('sortBy');
		const currentOrder = params.get('sortOrder') || 'desc';

		if (currentSort === column) {
			params.set('sortOrder', currentOrder === 'asc' ? 'desc' : 'asc');
		} else {
			params.set('sortBy', column);
			params.set('sortOrder', 'desc');
		}
		params.delete('page');
		goto(`?${params.toString()}`);
	}

	function openDeleteDialog(offer: { id: number; offerNumber: string }) {
		selectedOffer = offer;
		deleteDialogOpen = true;
	}

	function formatCurrency(amount: number, currency: string = 'USD'): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency
		}).format(amount);
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
			{#if selectedIds.size > 0}
				<Button variant="destructive" onclick={() => (bulkDeleteDialogOpen = true)}>
					<Trash2 class="mr-2 h-4 w-4" />
					Delete ({selectedIds.size})
				</Button>
			{/if}
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
				<div class="text-2xl font-bold">{formatCurrency(data.summary.totalAmount)}</div>
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
					{formatCurrency(data.summary.count > 0 ? data.summary.totalAmount / data.summary.count : 0)}
				</div>
				<p class="text-muted-foreground text-xs">Per offer</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-4">
		<div class="flex items-center gap-2">
			<Input
				type="search"
				placeholder="Search offers..."
				class="w-48"
				bind:value={searchInput}
				onkeydown={(e) => e.key === 'Enter' && handleSearch()}
			/>
			<Button variant="outline" size="icon" onclick={handleSearch}>
				<Search class="h-4 w-4" />
			</Button>
		</div>

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
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => toggleSort('offerNumber')}>
							Offer #
							<ArrowUpDown class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => toggleSort('title')}>
							Title
							<ArrowUpDown class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => toggleSort('date')}>
							Date
							<ArrowUpDown class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>Client</Table.Head>
					<Table.Head>Status</Table.Head>
					<Table.Head class="text-center">Options</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => toggleSort('validUntil')}>
							Valid Until
							<ArrowUpDown class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head class="text-right">
						<Button variant="ghost" class="-mr-4" onclick={() => toggleSort('grandTotal')}>
							Grand Total
							<ArrowUpDown class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
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
							{formatCurrency(offer.grandTotal, offer.currency)}
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
									onclick={() => openDeleteDialog({ id: offer.id, offerNumber: offer.offerNumber })}
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

	<!-- Pagination -->
	{#if data.totalPages > 1}
		<div class="flex items-center justify-between">
			<p class="text-muted-foreground text-sm">
				Showing {(data.page - 1) * data.pageSize + 1} to {Math.min(
					data.page * data.pageSize,
					data.totalCount
				)} of {data.totalCount} offers
			</p>
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={data.page <= 1}
					onclick={() => updateFilter('page', String(data.page - 1))}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={data.page >= data.totalPages}
					onclick={() => updateFilter('page', String(data.page + 1))}
				>
					Next
				</Button>
			</div>
		</div>
	{/if}
</div>

<!-- Bulk Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={bulkDeleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {selectedIds.size} Offer{selectedIds.size !== 1 ? 's' : ''}</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete {selectedIds.size} selected offer{selectedIds.size !== 1 ? 's' : ''}?
				This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				onclick={handleBulkDelete}
				disabled={isBulkDeleting}
			>
				{isBulkDeleting ? 'Deleting...' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Offer</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete offer "{selectedOffer?.offerNumber}"? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/delete"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						deleteDialogOpen = false;
						selectedOffer = null;
					};
				}}
			>
				<input type="hidden" name="id" value={selectedOffer?.id} />
				<Button type="submit" variant="destructive">Delete</Button>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
