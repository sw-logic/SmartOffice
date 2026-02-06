<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Select from '$lib/components/ui/select';
	import * as Avatar from '$lib/components/ui/avatar';
	import {
		Plus,
		Search,
		ArrowUpDown,
		ArrowUp,
		ArrowDown,
		Pencil,
		Trash2,
		ChevronLeft,
		ChevronRight,
		RotateCcw,
		Eye,
		Building2,
		Users,
		Receipt
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let search = $state(data.filters.search);
	let deleteDialogOpen = $state(false);
	let restoreDialogOpen = $state(false);
	let vendorToDelete = $state<{ id: number; name: string } | null>(null);
	let vendorToRestore = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);
	let isRestoring = $state(false);

	const statusOptions = [
		{ value: 'active', label: 'Active vendors' },
		{ value: 'inactive', label: 'Inactive vendors' },
		{ value: 'deleted', label: 'Deleted vendors' },
		{ value: 'all', label: 'All vendors' }
	];

	// Filter out deleted option for non-admins
	const availableStatusOptions = $derived(
		data.isAdmin ? statusOptions : statusOptions.filter(o => o.value !== 'deleted' && o.value !== 'all')
	);

	function updateSearch() {
		const url = new URL($page.url);
		if (search) {
			url.searchParams.set('search', search);
		} else {
			url.searchParams.delete('search');
		}
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true });
	}

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

	function updateSort(column: string) {
		const url = new URL($page.url);
		const currentSort = url.searchParams.get('sortBy');
		const currentOrder = url.searchParams.get('sortOrder') || 'asc';

		if (currentSort === column) {
			url.searchParams.set('sortOrder', currentOrder === 'asc' ? 'desc' : 'asc');
		} else {
			url.searchParams.set('sortBy', column);
			url.searchParams.set('sortOrder', 'asc');
		}
		goto(url.toString(), { replaceState: true });
	}

	function goToPage(newPage: number) {
		const url = new URL($page.url);
		url.searchParams.set('page', newPage.toString());
		goto(url.toString(), { replaceState: true });
	}

	function getSortIcon(column: string) {
		if (data.filters.sortBy !== column) return ArrowUpDown;
		return data.filters.sortOrder === 'asc' ? ArrowUp : ArrowDown;
	}

	function confirmDelete(vendor: { id: number; name: string }) {
		vendorToDelete = vendor;
		deleteDialogOpen = true;
	}

	function confirmRestore(vendor: { id: number; name: string }) {
		vendorToRestore = vendor;
		restoreDialogOpen = true;
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

	async function handleRestore() {
		if (!vendorToRestore) return;

		isRestoring = true;
		const formData = new FormData();
		formData.append('id', String(vendorToRestore.id));

		const response = await fetch('?/restore', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Vendor restored successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to restore vendor');
		}

		isRestoring = false;
		restoreDialogOpen = false;
		vendorToRestore = null;
	}

	function isVendorDeleted(vendor: { deletedAt: string | Date | null }): boolean {
		return vendor.deletedAt !== null;
	}

	function canEditVendor(vendor: { deletedAt: string | Date | null }): boolean {
		if (isVendorDeleted(vendor)) {
			return data.isAdmin;
		}
		return true;
	}

	function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'active':
				return 'default';
			case 'inactive':
				return 'secondary';
			default:
				return 'secondary';
		}
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
		<div class="relative flex-1 max-w-sm">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search vendors..."
				class="pl-10 pr-10"
				bind:value={search}
				onkeydown={(e) => e.key === 'Enter' && updateSearch()}
				oninput={(e) => {
					if (e.currentTarget.value === '' && data.filters.search) {
						updateSearch();
					}
				}}
			/>
			{#if search}
				<Button
					variant="ghost"
					size="icon"
					class="absolute right-0 top-1/2 -translate-y-1/2 h-full px-3 hover:bg-transparent"
					onclick={updateSearch}
				>
					<Search class="h-4 w-4" />
				</Button>
			{/if}
		</div>

		<Select.Root
			type="single"
			value={data.filters.status}
			onValueChange={updateStatus}
		>
			<Select.Trigger class="w-[180px]">
				{availableStatusOptions.find(o => o.value === data.filters.status)?.label || 'Active vendors'}
			</Select.Trigger>
			<Select.Content>
				{#each availableStatusOptions as option}
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
					<Table.Head class="w-[250px]">
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('name')}>
							Vendor
							<svelte:component this={getSortIcon('name')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('email')}>
							Email
							<svelte:component this={getSortIcon('email')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('city')}>
							Location
							<svelte:component this={getSortIcon('city')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>Category</Table.Head>
					<Table.Head class="w-[100px]">Status</Table.Head>
					<Table.Head class="text-center">Expenses</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('createdAt')}>
							Created
							<svelte:component this={getSortIcon('createdAt')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
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
							class="cursor-pointer hover:bg-muted/50 {isVendorDeleted(vendor) ? 'opacity-60' : ''}"
							onclick={() => goto(`/vendors/${vendor.id}`)}
						>
							<Table.Cell>
								<div class="flex items-center gap-3">
									<Avatar.Root>
										<Avatar.Fallback class="text-xs">{vendor.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}</Avatar.Fallback>
									</Avatar.Root>
									<div class="flex flex-col">
										<span class="font-medium">
											{vendor.name}
											{#if isVendorDeleted(vendor)}
												<span class="text-muted-foreground text-xs ml-2">(deleted)</span>
											{/if}
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
								{#if isVendorDeleted(vendor)}
									<Badge variant="destructive">Deleted</Badge>
								{:else}
									<Badge variant={getStatusBadgeVariant(vendor.status)}>
										{vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
									</Badge>
								{/if}
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
								{new Date(vendor.createdAt).toLocaleDateString()}
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-1">
									<Button variant="ghost" size="icon" href="/vendors/{vendor.id}" title="View vendor">
										<Eye class="h-4 w-4" />
									</Button>
									{#if canEditVendor(vendor)}
										<Button variant="ghost" size="icon" href="/vendors/{vendor.id}/edit" title="Edit vendor">
											<Pencil class="h-4 w-4" />
										</Button>
									{/if}
									{#if isVendorDeleted(vendor)}
										{#if data.isAdmin}
											<Button
												variant="ghost"
												size="icon"
												onclick={() => confirmRestore({ id: vendor.id, name: vendor.name })}
												title="Restore vendor"
											>
												<RotateCcw class="h-4 w-4" />
											</Button>
										{/if}
									{:else}
										<Button
											variant="ghost"
											size="icon"
											onclick={() => confirmDelete({ id: vendor.id, name: vendor.name })}
											title="Delete vendor"
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

	{#if data.pagination.totalPages > 1}
		<div class="flex items-center justify-between">
			<p class="text-sm text-muted-foreground">
				Showing {(data.pagination.page - 1) * data.pagination.limit + 1} to {Math.min(
					data.pagination.page * data.pagination.limit,
					data.pagination.total
				)} of {data.pagination.total} vendors
			</p>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={data.pagination.page === 1}
					onclick={() => goToPage(data.pagination.page - 1)}
				>
					<ChevronLeft class="h-4 w-4" />
					Previous
				</Button>
				<span class="text-sm">
					Page {data.pagination.page} of {data.pagination.totalPages}
				</span>
				<Button
					variant="outline"
					size="sm"
					disabled={data.pagination.page === data.pagination.totalPages}
					onclick={() => goToPage(data.pagination.page + 1)}
				>
					Next
					<ChevronRight class="h-4 w-4" />
				</Button>
			</div>
		</div>
	{/if}
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Vendor</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{vendorToDelete?.name}</strong>? This action can be
				undone by an administrator.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				onclick={handleDelete}
				disabled={isDeleting}
			>
				{isDeleting ? 'Deleting...' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Restore Confirmation Dialog -->
<AlertDialog.Root bind:open={restoreDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Restore Vendor</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to restore <strong>{vendorToRestore?.name}</strong>?
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={handleRestore}
				disabled={isRestoring}
			>
				{isRestoring ? 'Restoring...' : 'Restore'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
