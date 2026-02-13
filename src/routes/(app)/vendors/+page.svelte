<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { saveListState, restoreListState } from '$lib/utils/list-state';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import UserAvatar from '$lib/components/shared/UserAvatar.svelte';
	import { ListSearch, SortableHeader, ListPagination, DeleteConfirmDialog } from '$lib/components/shared/list';
	import {
		Plus,
		Pencil,
		Trash2,
		Eye,
		Building2,
		Users,
		Receipt
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	// Persist/restore list view state
	const LIST_ROUTE = '/vendors';
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

	let deleteDialogOpen = $state(false);
	let vendorToDelete = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);

	const statusOptions = [
		{ value: 'active', label: 'Active vendors' },
		{ value: 'inactive', label: 'Inactive vendors' }
	];

	function updateStatus(value: string | undefined) {
		if (!value) return;
		const url = new URL($page.url);
		url.searchParams.set('status', value);
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true });
	}

	function updateCategory(value: string | undefined) {
		const url = new URL($page.url);
		if (value) {
			url.searchParams.set('category', value);
		} else {
			url.searchParams.delete('category');
		}
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true });
	}

	function confirmDelete(vendor: { id: number; name: string }) {
		vendorToDelete = vendor;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!vendorToDelete) return;

		isDeleting = true;
		const formData = new FormData();
		formData.append('id', String(vendorToDelete.id));

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Vendor deleted successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete vendor');
		}

		isDeleting = false;
		deleteDialogOpen = false;
		vendorToDelete = null;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Vendors</h1>
			<p class="text-muted-foreground">Manage your vendors and suppliers</p>
		</div>
		<Button href="/vendors/new">
			<Plus class="mr-2 h-4 w-4" />
			Add Vendor
		</Button>
	</div>

	<div class="flex items-center gap-4 flex-wrap">
		<ListSearch placeholder="Search vendors..." />

		<Select.Root
			type="single"
			value={data.filters.status}
			onValueChange={updateStatus}
		>
			<Select.Trigger class="w-[180px]">
				{statusOptions.find(o => o.value === data.filters.status)?.label || 'All vendors'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="all">All vendors</Select.Item>
				{#each statusOptions as option}
					<Select.Item value={option.value}>{option.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		{#if data.categories.length > 0}
			<Select.Root
				type="single"
				value={data.filters.category}
				onValueChange={updateCategory}
			>
				<Select.Trigger class="w-[180px]">
					{data.filters.category || 'All categories'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">All categories</Select.Item>
					{#each data.categories as cat}
						<Select.Item value={cat}>{cat}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		{/if}
	</div>

	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<SortableHeader column="name" label="Vendor" class="w-[250px]" />
					<SortableHeader column="email" label="Email" />
					<SortableHeader column="city" label="Location" />
					<Table.Head>Category</Table.Head>
					<Table.Head class="w-[100px]">Status</Table.Head>
					<Table.Head class="text-center">Expenses</Table.Head>
					<SortableHeader column="createdAt" label="Created" />
					<Table.Head class="w-[140px]">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.vendors.length === 0}
					<Table.Row>
						<Table.Cell colspan={8} class="h-24 text-center">
							No vendors found.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.vendors as vendor}
						<Table.Row
							class="cursor-pointer hover:bg-muted/50"
							onclick={() => goto(`/vendors/${vendor.id}`)}
						>
							<Table.Cell>
								<div class="flex items-center gap-3">
									<UserAvatar user={{ name: vendor.name }} />
									<div class="flex flex-col">
										<span class="font-medium">
											{vendor.name}
										</span>
										{#if vendor.companyName}
											<span class="text-sm text-muted-foreground flex items-center gap-1">
												<Building2 class="h-3 w-3" />
												{vendor.companyName}
											</span>
										{/if}
									</div>
								</div>
							</Table.Cell>
							<Table.Cell>
								{#if vendor.email}
									<a href="mailto:{vendor.email}" class="text-primary hover:underline">
										{vendor.email}
									</a>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if vendor.city || vendor.country}
									{[vendor.city, vendor.country].filter(Boolean).join(', ')}
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if vendor.category}
									<Badge variant="outline">{vendor.category}</Badge>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								<EnumBadge enums={data.enums.entity_status} value={vendor.status} />
							</Table.Cell>
							<Table.Cell class="text-center">
								<div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
									<span class="flex items-center gap-1" title="Expenses">
										<Receipt class="h-3 w-3" />
										{vendor.expenseCount}
									</span>
									<span class="flex items-center gap-1" title="Contacts">
										<Users class="h-3 w-3" />
										{vendor.contactCount}
									</span>
								</div>
							</Table.Cell>
							<Table.Cell>
								{formatDate(vendor.createdAt)}
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
									<Button variant="ghost" size="icon" href="/vendors/{vendor.id}" title="View vendor">
										<Eye class="h-4 w-4" />
									</Button>
									<Button variant="ghost" size="icon" href="/vendors/{vendor.id}/edit" title="Edit vendor">
										<Pencil class="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onclick={() => confirmDelete({ id: vendor.id, name: vendor.name })}
										title="Delete vendor"
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	<ListPagination pagination={data.pagination} noun="vendors" />
</div>

<DeleteConfirmDialog
	bind:open={deleteDialogOpen}
	title="Delete Vendor"
	name={vendorToDelete?.name}
	{isDeleting}
	onconfirm={handleDelete}
/>
