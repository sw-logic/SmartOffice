<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { saveListState, restoreListState } from '$lib/utils/list-state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
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
		Users,
		Shield
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	// Persist/restore list view state
	const LIST_ROUTE = '/users/groups';
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

	let search = $state(data.filters.search);
	let deleteDialogOpen = $state(false);
	let groupToDelete = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);

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
						<Table.Cell colspan={6} class="h-24 text-center">
							No groups found.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.groups as group}
						<Table.Row>
							<Table.Cell class="font-medium">
								{group.name}
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
							<Table.Cell>
								{formatDate(group.createdAt)}
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-1">
									<Button variant="ghost" size="icon" href="/users/groups/{group.id}/edit">
										<Pencil class="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onclick={() => confirmDelete({ id: group.id, name: group.name })}
										title="Delete group"
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
				Are you sure you want to delete <strong>{groupToDelete?.name}</strong>? This action cannot be undone.
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
