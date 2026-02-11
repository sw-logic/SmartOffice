<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { saveListState, restoreListState } from '$lib/utils/list-state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Pencil, Trash2, Plus, Search, ArrowUpDown } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';
	import { createCurrencyFormatter } from '$lib/utils/currency';

	let { data } = $props();

	const fmt = createCurrencyFormatter(data.enums.currency);

	// Persist/restore list view state
	const LIST_ROUTE = '/pricelists';
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

	let searchInput = $state(data.filters.search);
	let deleteDialogOpen = $state(false);
	let selectedItem = $state<{ id: number; name: string } | null>(null);

	const unitLabels: Record<string, string> = {
		hour: 'Hour',
		piece: 'Piece',
		project: 'Project',
		day: 'Day',
		month: 'Month',
		year: 'Year',
		unit: 'Unit'
	};

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
		const currentOrder = params.get('sortOrder') || 'asc';

		if (currentSort === column) {
			params.set('sortOrder', currentOrder === 'asc' ? 'desc' : 'asc');
		} else {
			params.set('sortBy', column);
			params.set('sortOrder', 'asc');
		}
		params.delete('page');
		goto(`?${params.toString()}`);
	}

	function openDeleteDialog(item: { id: number; name: string }) {
		selectedItem = item;
		deleteDialogOpen = true;
	}

	function isValidNow(validFrom: Date | null, validTo: Date | null): boolean {
		const now = new Date();
		if (validFrom && new Date(validFrom) > now) return false;
		if (validTo && new Date(validTo) < now) return false;
		return true;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Price List</h1>
			<p class="text-muted-foreground">Manage your products and services pricing</p>
		</div>
		<Button href="/pricelists/new">
			<Plus class="mr-2 h-4 w-4" />
			Add Item
		</Button>
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-4">
		<div class="flex items-center gap-2">
			<Input
				type="search"
				placeholder="Search items..."
				class="w-64"
				bind:value={searchInput}
				onkeydown={(e) => e.key === 'Enter' && handleSearch()}
			/>
			<Button variant="outline" size="icon" onclick={handleSearch}>
				<Search class="h-4 w-4" />
			</Button>
		</div>

		<Select.Root
			type="single"
			value={data.filters.category}
			onValueChange={(v) => updateFilter('category', v)}
		>
			<Select.Trigger class="w-48">
				{data.filters.category || 'All Categories'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All Categories</Select.Item>
				{#each data.categories as cat}
					<Select.Item value={cat}>{cat}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Select.Root
			type="single"
			value={data.filters.active}
			onValueChange={(v) => updateFilter('active', v)}
		>
			<Select.Trigger class="w-32">
				{data.filters.active === 'true'
					? 'Active'
					: data.filters.active === 'false'
						? 'Inactive'
						: 'All'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All</Select.Item>
				<Select.Item value="true">Active</Select.Item>
				<Select.Item value="false">Inactive</Select.Item>
			</Select.Content>
		</Select.Root>
	</div>

	<!-- Table -->
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[100px]">SKU</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => toggleSort('name')}>
							Name
							<ArrowUpDown class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>Category</Table.Head>
					<Table.Head class="text-right">
						<Button variant="ghost" class="-mr-4" onclick={() => toggleSort('unitPrice')}>
							Unit Price
							<ArrowUpDown class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>Unit</Table.Head>
					<Table.Head class="text-right">Tax Rate</Table.Head>
					<Table.Head>Validity</Table.Head>
					<Table.Head>Status</Table.Head>
					<Table.Head class="text-center">Used</Table.Head>
					<Table.Head class="w-[80px]">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.items as item}
					<Table.Row>
						<Table.Cell class="font-mono text-sm">
							{item.sku || '-'}
						</Table.Cell>
						<Table.Cell>
							<div>
								<div class="font-medium">{item.name}</div>
								{#if item.description}
									<div class="text-sm text-muted-foreground line-clamp-1">
										{item.description}
									</div>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell>
							{#if item.category}
								<Badge variant="outline">{item.category}</Badge>
							{:else}
								<span class="text-muted-foreground">-</span>
							{/if}
						</Table.Cell>
						<Table.Cell class="text-right font-medium">
							{fmt.format(Number(item.unitPrice), item.currency)}
						</Table.Cell>
						<Table.Cell>
							{unitLabels[item.unitOfMeasure] || item.unitOfMeasure}
						</Table.Cell>
						<Table.Cell class="text-right">
							{item.taxRate ? `${Number(item.taxRate)}%` : '-'}
						</Table.Cell>
						<Table.Cell>
							{#if item.validFrom || item.validTo}
								<div class="text-sm">
									{#if item.validFrom}
										<div>From: {formatDate(item.validFrom)}</div>
									{/if}
									{#if item.validTo}
										<div>To: {formatDate(item.validTo)}</div>
									{/if}
									{#if !isValidNow(item.validFrom, item.validTo)}
										<Badge variant="secondary" class="mt-1">Expired</Badge>
									{/if}
								</div>
							{:else}
								<span class="text-muted-foreground">Always</span>
							{/if}
						</Table.Cell>
						<Table.Cell>
							{#if item.active}
								<Badge variant="default">Active</Badge>
							{:else}
								<Badge variant="secondary">Inactive</Badge>
							{/if}
						</Table.Cell>
						<Table.Cell class="text-center">
							{item._count.offerItems}
						</Table.Cell>
						<Table.Cell>
							<div class="flex items-center gap-1">
								<Button variant="ghost" size="icon" href="/pricelists/{item.id}/edit">
									<Pencil class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => openDeleteDialog({ id: item.id, name: item.name })}
								>
									<Trash2 class="h-4 w-4 text-destructive" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={10} class="text-center py-8">
							<div class="text-muted-foreground">No price list items found</div>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>

	<!-- Pagination -->
	{#if data.totalPages > 1}
		<div class="flex items-center justify-between">
			<p class="text-sm text-muted-foreground">
				Showing {(data.page - 1) * data.pageSize + 1} to {Math.min(
					data.page * data.pageSize,
					data.totalCount
				)} of {data.totalCount} items
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

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Item</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
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
						selectedItem = null;
					};
				}}
			>
				<input type="hidden" name="id" value={selectedItem?.id} />
				<Button type="submit" variant="destructive">Delete</Button>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

