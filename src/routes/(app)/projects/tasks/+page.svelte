<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { saveListState, restoreListState } from '$lib/utils/list-state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import * as Table from '$lib/components/ui/table';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Select from '$lib/components/ui/select';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import TaskDetailModal from '$lib/components/shared/TaskDetailModal.svelte';
	import {
		Plus,
		Search,
		ArrowUpDown,
		ArrowUp,
		ArrowDown,
		Trash2,
		Filter,
		X,
		Group
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	// Persist/restore list view state
	const LIST_ROUTE = '/projects/tasks';
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
	let taskToDelete = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);

	// Selection state
	let selectedIds = $state<Set<number>>(new Set());
	let bulkDeleteDialogOpen = $state(false);
	let isBulkDeleting = $state(false);

	const allSelected = $derived(
		data.tasks.length > 0 && data.tasks.every(t => selectedIds.has(t.id))
	);
	const someSelected = $derived(selectedIds.size > 0);

	function toggleSelectAll() {
		if (allSelected) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(data.tasks.map(t => t.id));
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
			toast.success(`${selectedIds.size} tasks deleted successfully`);
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete tasks');
		}

		isBulkDeleting = false;
		bulkDeleteDialogOpen = false;
		selectedIds = new Set();
	}

	// Modal state
	let modalOpen = $state(false);
	let modalTaskId = $state<number | null>(null);

	// Filter visibility
	let filtersExpanded = $state(
		!!(data.filters.projectId || data.filters.clientId || data.filters.boardId ||
		   data.filters.assigneeId || data.filters.taskStatus || data.filters.taskType ||
		   data.filters.taskCategory || data.filters.taskPriority)
	);

	// Group-by options
	const groupByOptions = [
		{ value: '', label: 'No grouping' },
		{ value: 'client', label: 'Client' },
		{ value: 'project', label: 'Project' },
		{ value: 'assignee', label: 'Assignee' },
		{ value: 'stage', label: 'Stage' },
		{ value: 'priority', label: 'Priority' },
		{ value: 'type', label: 'Type' },
		{ value: 'category', label: 'Category' }
	];

	// Per-page options
	const perPageOptions = [
		{ value: '25', label: '25' },
		{ value: '50', label: '50' },
		{ value: '100', label: '100' }
	];

	// Extract group key/label from a task
	function getGroupLabel(task: (typeof data.tasks)[0]): string {
		switch (data.filters.groupBy) {
			case 'client': return task.project.client.name;
			case 'project': return task.project.name;
			case 'assignee':
				return task.assignedTo
					? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
					: 'Unassigned';
			case 'stage': return formatStatus(task.status);
			case 'priority': return formatStatus(task.priority);
			case 'type':
				return task.type
					? (data.enums.task_type.find(t => t.value === task.type)?.label || task.type)
					: 'No Type';
			case 'category':
				return task.category
					? (data.enums.task_category.find(c => c.value === task.category)?.label || task.category)
					: 'No Category';
			default: return '';
		}
	}

	// Group tasks for rendering
	let groupedTasks = $derived((() => {
		if (!data.filters.groupBy) {
			return [{ label: '', tasks: data.tasks }];
		}
		const groups: { label: string; tasks: typeof data.tasks }[] = [];
		const map = new Map<string, typeof data.tasks>();
		for (const task of data.tasks) {
			const label = getGroupLabel(task);
			if (!map.has(label)) {
				const arr: typeof data.tasks = [];
				map.set(label, arr);
				groups.push({ label, tasks: arr });
			}
			map.get(label)!.push(task);
		}
		return groups;
	})());

	function updateUrl(params: Record<string, string | null>) {
		const url = new URL($page.url);
		for (const [key, value] of Object.entries(params)) {
			if (value) {
				url.searchParams.set(key, value);
			} else {
				url.searchParams.delete(key);
			}
		}
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true });
	}

	function updateSearch() {
		updateUrl({ search: search || null });
	}

	function updateFilter(key: string, value: string | undefined) {
		updateUrl({ [key]: value || null });
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

	function clearFilters() {
		const url = new URL($page.url);
		for (const key of ['projectId', 'clientId', 'boardId', 'assigneeId', 'taskStatus', 'taskType', 'taskCategory', 'taskPriority', 'search']) {
			url.searchParams.delete(key);
		}
		url.searchParams.set('page', '1');
		search = '';
		goto(url.toString(), { replaceState: true });
	}

	function hasActiveFilters(): boolean {
		return !!(data.filters.projectId || data.filters.clientId || data.filters.boardId ||
		          data.filters.assigneeId || data.filters.taskStatus || data.filters.taskType ||
		          data.filters.taskCategory || data.filters.taskPriority || data.filters.search);
	}

	function getSortIcon(column: string) {
		if (data.filters.sortBy !== column) return ArrowUpDown;
		return data.filters.sortOrder === 'asc' ? ArrowUp : ArrowDown;
	}

	function openTaskModal(taskId: number) {
		modalTaskId = taskId;
		modalOpen = true;
	}

	function openNewTaskModal() {
		modalTaskId = null;
		modalOpen = true;
	}

	function confirmDelete(task: { id: number; name: string }, e: Event) {
		e.stopPropagation();
		taskToDelete = task;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!taskToDelete) return;
		isDeleting = true;

		const formData = new FormData();
		formData.append('id', String(taskToDelete.id));

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Task deleted successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete task');
		}

		isDeleting = false;
		deleteDialogOpen = false;
		taskToDelete = null;
	}

	function formatStatus(s: string): string {
		return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
	}

	function getInitials(firstName: string | null, lastName: string | null): string {
		return `${(firstName ?? '').charAt(0)}${(lastName ?? '').charAt(0)}`.toUpperCase();
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Tasks</h1>
			<p class="text-muted-foreground">Manage tasks across all projects</p>
		</div>
		<div class="flex items-center gap-2">
			{#if someSelected}
				<Button variant="destructive" onclick={() => (bulkDeleteDialogOpen = true)}>
					<Trash2 class="mr-2 h-4 w-4" />
					Delete ({selectedIds.size})
				</Button>
			{/if}
			<Button onclick={openNewTaskModal}>
				<Plus class="mr-2 h-4 w-4" />
				New Task
			</Button>
		</div>
	</div>

	<!-- Search & Status filter row -->
	<div class="flex items-center gap-3">
		<div class="relative flex-1 max-w-sm">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search tasks..."
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

		<!-- Group by -->
		<Select.Root
			type="single"
			value={data.filters.groupBy || ''}
			onValueChange={(v) => updateUrl({ groupBy: v || null })}
		>
			<Select.Trigger class="w-[170px]">
				<Group class="mr-1 h-4 w-4 shrink-0 text-muted-foreground" />
				{groupByOptions.find(o => o.value === data.filters.groupBy)?.label || 'No grouping'}
			</Select.Trigger>
			<Select.Content>
				{#each groupByOptions as option}
					<Select.Item value={option.value}>{option.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Button
			variant={filtersExpanded ? 'secondary' : 'outline'}
			onclick={() => filtersExpanded = !filtersExpanded}
		>
			<Filter class="mr-1 h-4 w-4" />
			Filters
			{#if hasActiveFilters()}
				<Badge variant="default" class="ml-1 h-5 w-5 p-0 text-xs rounded-full">!</Badge>
			{/if}
		</Button>

		{#if hasActiveFilters()}
			<Button variant="ghost" onclick={clearFilters}>
				<X class="mr-1 h-4 w-4" />
				Clear
			</Button>
		{/if}
	</div>

	<!-- Filter dropdowns -->
	{#if filtersExpanded}
		<div class="flex flex-wrap gap-2 rounded-lg border p-3 bg-muted/30">
			<Select.Root
				type="single"
				value={data.filters.projectId || 'all'}
				onValueChange={(v) => updateFilter('projectId', v === 'all' ? undefined : v)}
			>
				<Select.Trigger class="w-[180px]">
					{data.filters.projectId ? data.projects.find(p => p.id === parseInt(data.filters.projectId))?.name || 'Project' : 'All Projects'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">All Projects</Select.Item>
					{#each data.projects as project}
						<Select.Item value={String(project.id)}>{project.name}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root
				type="single"
				value={data.filters.clientId || 'all'}
				onValueChange={(v) => updateFilter('clientId', v === 'all' ? undefined : v)}
			>
				<Select.Trigger class="w-[180px]">
					{data.filters.clientId ? data.clients.find(c => c.id === parseInt(data.filters.clientId))?.name || 'Client' : 'All Clients'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">All Clients</Select.Item>
					{#each data.clients as client}
						<Select.Item value={String(client.id)}>{client.name}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root
				type="single"
				value={data.filters.boardId || 'all'}
				onValueChange={(v) => updateFilter('boardId', v === 'all' ? undefined : v)}
			>
				<Select.Trigger class="w-[160px]">
					{data.filters.boardId ? data.boards.find(b => b.id === parseInt(data.filters.boardId))?.name || 'Board' : 'All Boards'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">All Boards</Select.Item>
					{#each data.boards as board}
						<Select.Item value={String(board.id)}>{board.name}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root
				type="single"
				value={data.filters.taskStatus || 'all'}
				onValueChange={(v) => updateFilter('taskStatus', v === 'all' ? undefined : v)}
			>
				<Select.Trigger class="w-[160px]">
					{data.filters.taskStatus ? data.taskStatuses.find(s => s.value === data.filters.taskStatus)?.label || 'Status' : 'All Statuses'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">All Statuses</Select.Item>
					{#each data.taskStatuses as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root
				type="single"
				value={data.filters.taskPriority || 'all'}
				onValueChange={(v) => updateFilter('taskPriority', v === 'all' ? undefined : v)}
			>
				<Select.Trigger class="w-[160px]">
					{data.filters.taskPriority ? data.taskPriorities.find(p => p.value === data.filters.taskPriority)?.label || 'Priority' : 'All Priorities'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">All Priorities</Select.Item>
					{#each data.taskPriorities as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root
				type="single"
				value={data.filters.assigneeId || 'all'}
				onValueChange={(v) => updateFilter('assigneeId', v === 'all' ? undefined : v)}
			>
				<Select.Trigger class="w-[180px]">
					{data.filters.assigneeId ? (() => { const e = data.employees.find(e => e.id === parseInt(data.filters.assigneeId)); return e ? `${e.firstName} ${e.lastName}` : 'Assignee'; })() : 'All Assignees'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">All Assignees</Select.Item>
					{#each data.employees as emp}
						<Select.Item value={String(emp.id)}>{emp.firstName} {emp.lastName}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>

			{#if data.enums.task_type.length > 0}
				<Select.Root
					type="single"
					value={data.filters.taskType || 'all'}
					onValueChange={(v) => updateFilter('taskType', v === 'all' ? undefined : v)}
				>
					<Select.Trigger class="w-[160px]">
						{data.filters.taskType ? data.enums.task_type.find(t => t.value === data.filters.taskType)?.label || 'Type' : 'All Types'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">All Types</Select.Item>
						{#each data.enums.task_type as option}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}

			{#if data.enums.task_category.length > 0}
				<Select.Root
					type="single"
					value={data.filters.taskCategory || 'all'}
					onValueChange={(v) => updateFilter('taskCategory', v === 'all' ? undefined : v)}
				>
					<Select.Trigger class="w-[160px]">
						{data.filters.taskCategory ? data.enums.task_category.find(c => c.value === data.filters.taskCategory)?.label || 'Category' : 'All Categories'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">All Categories</Select.Item>
						{#each data.enums.task_category as option}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}
		</div>
	{/if}

	<!-- Table -->
	{#if data.tasks.length === 0}
		<div class="rounded-md border">
			<Table.Root>
				<Table.Body>
					<Table.Row>
						<Table.Cell class="h-24 text-center">
							No tasks found.
						</Table.Cell>
					</Table.Row>
				</Table.Body>
			</Table.Root>
		</div>
	{:else}
		{#each groupedTasks as group, groupIdx}
			{#if group.label}
				<div class="flex items-center gap-2 {groupIdx > 0 ? 'mt-6' : ''}">
					<h3 class="text-sm font-semibold">{group.label}</h3>
					<Badge variant="secondary" class="text-xs">{group.tasks.length}</Badge>
				</div>
			{/if}
			<div class="rounded-md border {group.label ? 'mt-1' : ''}">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-[40px]">
								<Checkbox
									checked={allSelected}
									onCheckedChange={() => toggleSelectAll()}
								/>
							</Table.Head>
							<Table.Head class="w-[250px]">
								<Button variant="ghost" class="-ml-4" onclick={() => updateSort('name')}>
									Name
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
							<Table.Head class="w-[100px]">Status</Table.Head>
							<Table.Head class="w-[90px]">Priority</Table.Head>
							<Table.Head>
								<Button variant="ghost" class="-ml-4" onclick={() => updateSort('assignee')}>
									Assignee
									<svelte:component this={getSortIcon('assignee')} class="ml-2 h-4 w-4" />
								</Button>
							</Table.Head>
							<Table.Head>
								<Button variant="ghost" class="-ml-4" onclick={() => updateSort('dueDate')}>
									Due Date
									<svelte:component this={getSortIcon('dueDate')} class="ml-2 h-4 w-4" />
								</Button>
							</Table.Head>
							<Table.Head class="text-right w-[120px]">Est / Spent</Table.Head>
							<Table.Head class="w-[80px]">Actions</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each group.tasks as task}
							<Table.Row
								class="cursor-pointer hover:bg-muted/50"
								onclick={() => openTaskModal(task.id)}
							>
								<Table.Cell onclick={(e) => e.stopPropagation()}>
									<Checkbox
										checked={selectedIds.has(task.id)}
										onCheckedChange={() => toggleSelect(task.id)}
									/>
								</Table.Cell>
								<Table.Cell>
									<div class="flex flex-col">
										<span class="font-medium truncate max-w-[230px]">
											{task.name}
										</span>
										{#if task.type}
											<span class="text-xs text-muted-foreground">
												{data.enums.task_type.find(t => t.value === task.type)?.label || task.type}
											</span>
										{/if}
										{#if task.tags?.length}
											<div class="flex flex-wrap gap-1 mt-0.5">
												{#each task.tags as tag}
													<span
														class="text-[10px] leading-tight px-1 py-0 rounded border font-medium"
														style={tag.color ? `border-color: ${tag.color}; color: ${tag.color}` : ''}
													>{tag.label}</span>
												{/each}
											</div>
										{/if}
									</div>
								</Table.Cell>
								<Table.Cell class="text-sm">{task.project.name}</Table.Cell>
								<Table.Cell class="text-sm">{task.project.client.name}</Table.Cell>
								<Table.Cell>
									<EnumBadge enums={data.enums.task_status} value={task.status} />
								</Table.Cell>
								<Table.Cell>
									<EnumBadge enums={data.enums.priority} value={task.priority} />
								</Table.Cell>
								<Table.Cell>
									{#if task.assignedTo}
										<div class="flex items-center gap-1.5">
											<Avatar.Root class="h-6 w-6">
												{#if task.assignedTo.image}
													<Avatar.Image src="/api/uploads/{task.assignedTo.image}" alt="{task.assignedTo.firstName} {task.assignedTo.lastName}" />
												{/if}
												<Avatar.Fallback class="text-[9px]">
													{getInitials(task.assignedTo.firstName ?? '', task.assignedTo.lastName ?? '')}
												</Avatar.Fallback>
											</Avatar.Root>
											<span class="text-sm truncate max-w-[100px]">
												{task.assignedTo.firstName ?? ''} {task.assignedTo.lastName ?? ''}
											</span>
										</div>
									{:else}
										<span class="text-muted-foreground text-sm">-</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="text-sm">
									{#if task.dueDate}
										{formatDate(task.dueDate)}
									{:else}
										<span class="text-muted-foreground">-</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="text-sm text-right whitespace-nowrap">
									{Math.floor(task.spentTime / 60)}h {task.spentTime % 60}m
									{#if task.estimatedTime}
										<span class="text-muted-foreground">/ {Math.floor(task.estimatedTime / 60)}h {task.estimatedTime % 60}m</span>
									{/if}
								</Table.Cell>
								<Table.Cell>
									<div class="flex items-center gap-1">
										<Button
											variant="ghost"
											size="icon"
											class="h-8 w-8"
											onclick={(e) => confirmDelete({ id: task.id, name: task.name }, e)}
											title="Delete task"
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
		{/each}
	{/if}

	<!-- Pagination -->
	<div class="flex items-center justify-between">
		<p class="text-sm text-muted-foreground">
			{data.pagination.total} tasks
		</p>
		<div class="flex items-center gap-2">
			<span class="text-sm text-muted-foreground">Show</span>
			<Select.Root
				type="single"
				value={String(data.pagination.limit)}
				onValueChange={(v) => updateUrl({ limit: v, page: '1' })}
			>
				<Select.Trigger class="w-[70px] h-8">
					{data.pagination.limit}
				</Select.Trigger>
				<Select.Content>
					{#each perPageOptions as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<span class="text-sm text-muted-foreground">per page</span>
		</div>
	</div>
</div>

<!-- Task Detail Modal -->
<TaskDetailModal
	bind:open={modalOpen}
	onOpenChange={(v) => modalOpen = v}
	taskId={modalTaskId}
	projects={data.projects}
	employees={data.employees}
	taskTypes={data.enums.task_type}
	taskCategories={data.enums.task_category}
	taskPriorities={data.taskPriorities}
	availableTags={data.availableTags}
	timeRecordTypes={data.enums.time_record_type}
	timeRecordCategories={data.enums.time_record_category}
	currentUserId={data.user?.id}
	notePriorities={data.enums.note_priority}
	defaults={undefined}
	onTaskCreated={() => invalidateAll()}
	onTaskUpdated={() => invalidateAll()}
/>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Task</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{taskToDelete?.name}</strong>? This action cannot be undone.
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

<!-- Bulk Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={bulkDeleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {selectedIds.size} Tasks</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete {selectedIds.size} tasks? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				onclick={handleBulkDelete}
				disabled={isBulkDeleting}
			>
				{isBulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Tasks`}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
