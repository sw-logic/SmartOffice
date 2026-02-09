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
	import * as Select from '$lib/components/ui/select';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import {
		Search,
		ArrowUpDown,
		ArrowUp,
		ArrowDown,
		Trash2,
		ChevronLeft,
		ChevronRight,
		ChevronDown,
		ChevronRight as ChevronRightIcon,
		Eye,
		Users,
		ListChecks,
		Kanban
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	// Persist/restore list view state
	const LIST_ROUTE = '/projects/boards';
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
	let boardToDelete = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);
	let expandedGroups = $state<Record<string, boolean>>({});

	// Group boards by client name for grouped view
	let groupedBoards = $derived(() => {
		const groups: Record<string, typeof data.boards> = {};

		for (const board of data.boards) {
			const clientName = board.clientName;
			if (!groups[clientName]) {
				groups[clientName] = [];
			}
			groups[clientName].push(board);
		}

		// Sort groups alphabetically
		const sortedGroups: Array<{ name: string; boards: typeof data.boards }> = [];
		const sortedKeys = Object.keys(groups).sort();
		for (const key of sortedKeys) {
			sortedGroups.push({ name: key, boards: groups[key] });
		}

		return sortedGroups;
	});

	// Initialize expanded state for new groups
	$effect(() => {
		const groups = groupedBoards();
		for (const group of groups) {
			if (!(group.name in expandedGroups)) {
				expandedGroups[group.name] = true;
			}
		}
	});

	function toggleGroup(groupName: string) {
		expandedGroups[groupName] = !expandedGroups[groupName];
	}

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


	function updateClient(value: string | undefined) {
		const url = new URL($page.url);
		if (value && value !== 'all') {
			url.searchParams.set('client', value);
		} else {
			url.searchParams.delete('client');
		}
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true });
	}

	function updateGroupByClient(checked: boolean) {
		const url = new URL($page.url);
		if (checked) {
			url.searchParams.set('groupByClient', 'true');
		} else {
			url.searchParams.delete('groupByClient');
		}
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

	function confirmDelete(board: { id: number; name: string }) {
		boardToDelete = board;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!boardToDelete) return;

		isDeleting = true;
		const formData = new FormData();
		formData.append('id', String(boardToDelete.id));

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Board deleted successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete board');
		}

		isDeleting = false;
		deleteDialogOpen = false;
		boardToDelete = null;
	}


</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Boards</h1>
			<p class="text-muted-foreground">Kanban boards across all projects</p>
		</div>
	</div>

	<div class="flex items-center gap-4 flex-wrap">
		<div class="relative flex-1 max-w-sm">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search boards..."
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
			value={data.filters.client || 'all'}
			onValueChange={updateClient}
		>
			<Select.Trigger class="w-[180px]">
				{data.filters.client
					? data.clients.find(c => String(c.id) === data.filters.client)?.name || 'All Clients'
					: 'All Clients'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="all">All Clients</Select.Item>
				{#each data.clients as client}
					<Select.Item value={String(client.id)}>{client.name}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<label class="flex items-center gap-2 text-sm cursor-pointer">
			<Checkbox
				checked={data.filters.groupByClient}
				onCheckedChange={(checked) => updateGroupByClient(checked === true)}
			/>
			Group by client
		</label>

	</div>

	{#if data.filters.groupByClient}
		<!-- Grouped view -->
		{#if data.boards.length === 0}
			<div class="rounded-md border p-8 text-center text-muted-foreground">
				No boards found.
			</div>
		{:else}
			<div class="space-y-4">
				{#each groupedBoards() as group}
					<div class="rounded-md border">
						<button
							type="button"
							class="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
							onclick={() => toggleGroup(group.name)}
						>
							<div class="flex items-center gap-2">
								{#if expandedGroups[group.name]}
									<ChevronDown class="h-4 w-4" />
								{:else}
									<ChevronRightIcon class="h-4 w-4" />
								{/if}
								<span class="font-semibold">{group.name}</span>
								<Badge variant="secondary">{group.boards.length}</Badge>
							</div>
						</button>

						{#if expandedGroups[group.name]}
							<div class="border-t">
								<Table.Root>
									<Table.Header>
										<Table.Row>
											<Table.Head class="w-[250px]">Board Name</Table.Head>
											<Table.Head>Project</Table.Head>
											<Table.Head class="text-center">Members</Table.Head>
											<Table.Head class="text-center">Tasks</Table.Head>
											<Table.Head>Created</Table.Head>
											<Table.Head class="w-[120px]">Actions</Table.Head>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{#each group.boards as board}
											<Table.Row
												class="cursor-pointer hover:bg-muted/50"
												onclick={() => goto(`/projects/boards/${board.id}`)}
											>
												<Table.Cell>
													<span class="font-medium">
														{board.name}
													</span>
												</Table.Cell>
												<Table.Cell>{board.projectName}</Table.Cell>
												<Table.Cell class="text-center">
													<span class="flex items-center justify-center gap-1 text-sm text-muted-foreground">
														<Users class="h-3 w-3" />
														{board.memberCount}
													</span>
												</Table.Cell>
												<Table.Cell class="text-center">
													<span class="flex items-center justify-center gap-1 text-sm text-muted-foreground">
														<ListChecks class="h-3 w-3" />
														{board.taskCount}
													</span>
												</Table.Cell>
												<Table.Cell>
													{formatDate(board.createdAt)}
												</Table.Cell>
												<Table.Cell>
													<div class="flex items-center gap-1">
														<Button variant="ghost" size="icon" href="/projects/boards/{board.id}" title="View board">
															<Eye class="h-4 w-4" />
														</Button>
															<Button
															variant="ghost"
															size="icon"
															onclick={(e) => { e.stopPropagation(); confirmDelete({ id: board.id, name: board.name }); }}
															title="Delete board"
														>
															<Trash2 class="h-4 w-4" />
														</Button>
													</div>
												</Table.Cell>
											</Table.Row>
										{/each}
									</Table.Body>
								</Table.Root>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<!-- Flat table view -->
		<div class="rounded-md border">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-[250px]">
							<Button variant="ghost" class="-ml-4" onclick={() => updateSort('name')}>
								Board Name
								<svelte:component this={getSortIcon('name')} class="ml-2 h-4 w-4" />
							</Button>
						</Table.Head>
						<Table.Head>
							<Button variant="ghost" class="-ml-4" onclick={() => updateSort('project')}>
								Project
								<svelte:component this={getSortIcon('project')} class="ml-2 h-4 w-4" />
							</Button>
						</Table.Head>
						<Table.Head>
							<Button variant="ghost" class="-ml-4" onclick={() => updateSort('client')}>
								Client
								<svelte:component this={getSortIcon('client')} class="ml-2 h-4 w-4" />
							</Button>
						</Table.Head>
						<Table.Head class="text-center">Members</Table.Head>
						<Table.Head class="text-center">Tasks</Table.Head>
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
					{#if data.boards.length === 0}
						<Table.Row>
							<Table.Cell colspan={7} class="h-24 text-center">
								No boards found.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each data.boards as board}
							<Table.Row
								class="cursor-pointer hover:bg-muted/50"
								onclick={() => goto(`/projects/boards/${board.id}`)}
							>
								<Table.Cell>
									<span class="font-medium">
										{board.name}
									</span>
								</Table.Cell>
								<Table.Cell>{board.projectName}</Table.Cell>
								<Table.Cell>{board.clientName}</Table.Cell>
								<Table.Cell class="text-center">
									<span class="flex items-center justify-center gap-1 text-sm text-muted-foreground">
										<Users class="h-3 w-3" />
										{board.memberCount}
									</span>
								</Table.Cell>
								<Table.Cell class="text-center">
									<span class="flex items-center justify-center gap-1 text-sm text-muted-foreground">
										<ListChecks class="h-3 w-3" />
										{board.taskCount}
									</span>
								</Table.Cell>
								<Table.Cell>
									{formatDate(board.createdAt)}
								</Table.Cell>
								<Table.Cell>
									<div class="flex items-center gap-1">
										<Button variant="ghost" size="icon" href="/projects/boards/{board.id}" title="View board">
											<Eye class="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onclick={(e) => { e.stopPropagation(); confirmDelete({ id: board.id, name: board.name }); }}
											title="Delete board"
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
	{/if}

	{#if data.pagination.totalPages > 1}
		<div class="flex items-center justify-between">
			<p class="text-sm text-muted-foreground">
				Showing {(data.pagination.page - 1) * data.pagination.limit + 1} to {Math.min(
					data.pagination.page * data.pagination.limit,
					data.pagination.total
				)} of {data.pagination.total} boards
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
			<AlertDialog.Title>Delete Board</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{boardToDelete?.name}</strong>? This action cannot be undone.
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

