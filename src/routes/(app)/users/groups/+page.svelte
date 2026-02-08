<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Select from '$lib/components/ui/select';
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
		Users,
		Shield
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	let search = $state(data.filters.search);
	let deleteDialogOpen = $state(false);
	let restoreDialogOpen = $state(false);
	let groupToDelete = $state<{ id: number; name: string } | null>(null);
	let groupToRestore = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);
	let isRestoring = $state(false);

	const statusOptions = [
		{ value: 'active', label: 'Active groups' },
		{ value: 'deleted', label: 'Deleted groups' },
		{ value: 'all', label: 'All groups' }
	];

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

	function confirmDelete(group: { id: number; name: string }) {
		groupToDelete = group;
		deleteDialogOpen = true;
	}

	function confirmRestore(group: { id: number; name: string }) {
		groupToRestore = group;
		restoreDialogOpen = true;
	}

	async function handleDelete() {
		if (!groupToDelete) return;

		isDeleting = true;
		const formData = new FormData();
		formData.append('id', String(groupToDelete.id));

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Group deleted successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete group');
		}

		isDeleting = false;
		deleteDialogOpen = false;
		groupToDelete = null;
	}

	async function handleRestore() {
		if (!groupToRestore) return;

		isRestoring = true;
		const formData = new FormData();
		formData.append('id', String(groupToRestore.id));

		const response = await fetch('?/restore', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Group restored successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to restore group');
		}

		isRestoring = false;
		restoreDialogOpen = false;
		groupToRestore = null;
	}

	function isGroupDeleted(group: { deletedAt: string | Date | null }): boolean {
		return group.deletedAt !== null;
	}

	function canEditGroup(group: { deletedAt: string | Date | null }): boolean {
		if (isGroupDeleted(group)) {
			return data.isAdmin;
		}
		return true;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">User Groups</h1>
			<p class="text-muted-foreground">Manage user groups and their permissions</p>
		</div>
		<Button href="/users/groups/new">
			<Plus class="mr-2 h-4 w-4" />
			Add Group
		</Button>
	</div>

	<div class="flex items-center gap-4">
		<div class="relative flex-1 max-w-sm">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search groups..."
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

		{#if data.isAdmin}
			<Select.Root
				type="single"
				value={data.filters.status}
				onValueChange={updateStatus}
			>
				<Select.Trigger class="w-[180px]">
					{statusOptions.find(o => o.value === data.filters.status)?.label || 'Active groups'}
				</Select.Trigger>
				<Select.Content>
					{#each statusOptions as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
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
							Name
							<svelte:component this={getSortIcon('name')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>Description</Table.Head>
					<Table.Head class="w-[100px]">
						<div class="flex items-center gap-1">
							<Users class="h-4 w-4" />
							Users
						</div>
					</Table.Head>
					<Table.Head class="w-[120px]">
						<div class="flex items-center gap-1">
							<Shield class="h-4 w-4" />
							Permissions
						</div>
					</Table.Head>
					{#if data.isAdmin}
						<Table.Head class="w-[100px]">Status</Table.Head>
					{/if}
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('createdAt')}>
							Created
							<svelte:component this={getSortIcon('createdAt')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head class="w-[120px]">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.groups.length === 0}
					<Table.Row>
						<Table.Cell colspan={data.isAdmin ? 7 : 6} class="h-24 text-center">
							No groups found.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.groups as group}
						<Table.Row class={isGroupDeleted(group) ? 'opacity-60' : ''}>
							<Table.Cell class="font-medium">
								{group.name}
								{#if isGroupDeleted(group)}
									<span class="text-muted-foreground text-xs ml-2">(deleted)</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if group.description}
									<span class="text-muted-foreground">{group.description}</span>
								{:else}
									<span class="text-muted-foreground text-sm">No description</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								<Badge variant="secondary">{group.userCount}</Badge>
							</Table.Cell>
							<Table.Cell>
								<Badge variant="outline">{group.permissionCount}</Badge>
							</Table.Cell>
							{#if data.isAdmin}
								<Table.Cell>
									{#if isGroupDeleted(group)}
										<Badge variant="destructive">Deleted</Badge>
									{:else}
										<Badge variant="default">Active</Badge>
									{/if}
								</Table.Cell>
							{/if}
							<Table.Cell>
								{formatDate(group.createdAt)}
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-1">
									{#if canEditGroup(group)}
										<Button variant="ghost" size="icon" href="/users/groups/{group.id}/edit">
											<Pencil class="h-4 w-4" />
										</Button>
									{/if}
									{#if isGroupDeleted(group)}
										{#if data.isAdmin}
											<Button
												variant="ghost"
												size="icon"
												onclick={() => confirmRestore({ id: group.id, name: group.name })}
												title="Restore group"
											>
												<RotateCcw class="h-4 w-4" />
											</Button>
										{/if}
									{:else}
										<Button
											variant="ghost"
											size="icon"
											onclick={() => confirmDelete({ id: group.id, name: group.name })}
											title="Delete group"
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
				)} of {data.pagination.total} groups
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
			<AlertDialog.Title>Delete Group</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{groupToDelete?.name}</strong>? This action can be
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
			<AlertDialog.Title>Restore Group</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to restore <strong>{groupToRestore?.name}</strong>?
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
