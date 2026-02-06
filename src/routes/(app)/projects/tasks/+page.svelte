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
	import TaskDetailModal from '$lib/components/shared/TaskDetailModal.svelte';
	import {
		Plus,
		Search,
		ArrowUpDown,
		ArrowUp,
		ArrowDown,
		Trash2,
		ChevronLeft,
		ChevronRight,
		RotateCcw,
		Filter,
		X,
		Group,
		ChevronsUpDown
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let search = $state(data.filters.search);
	let deleteDialogOpen = $state(false);
	let restoreDialogOpen = $state(false);
	let taskToDelete = $state<{ id: number; name: string } | null>(null);
	let taskToRestore = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);
	let isRestoring = $state(false);

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

	// Sort-by options
	const sortByOptions = [
		{ value: 'name', label: 'Name' },
		{ value: 'project', label: 'Project' },
		{ value: 'client', label: 'Client' },
		{ value: 'assignee', label: 'Assignee' },
		{ value: 'dueDate', label: 'Due Date' },
		{ value: 'status', label: 'Stage' },
		{ value: 'priority', label: 'Priority' }
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
					? (data.taskTypes.find(t => t.value === task.type)?.label || task.type)
					: 'No Type';
			case 'category':
				return task.category
					? (data.taskCategories.find(c => c.value === task.category)?.label || task.category)
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

	const deletedStatusOptions = [
		{ value: 'active', label: 'Active tasks' },
		{ value: 'deleted', label: 'Deleted tasks' },
		{ value: 'all', label: 'All tasks' }
	];

	const availableDeletedStatusOptions = $derived(
		data.isAdmin ? deletedStatusOptions : deletedStatusOptions.filter(o => o.value !== 'deleted' && o.value !== 'all')
	);

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

	function goToPage(newPage: number) {
		const url = new URL($page.url);
		url.searchParams.set('page', newPage.toString());
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

	function confirmRestore(task: { id: number; name: string }, e: Event) {
		e.stopPropagation();
		taskToRestore = task;
		restoreDialogOpen = true;
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

	async function handleRestore() {
		if (!taskToRestore) return;
		isRestoring = true;

		const formData = new FormData();
		formData.append('id', String(taskToRestore.id));

		const response = await fetch('?/restore', {
			method: 'POST',
			body: formData
		});
		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Task restored successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to restore task');
		}

		isRestoring = false;
		restoreDialogOpen = false;
		taskToRestore = null;
	}

	function isTaskDeleted(task: { deletedAt: string | Date | null }): boolean {
		return task.deletedAt !== null;
	}

	function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'done': return 'default';
			case 'in_progress':
			case 'review': return 'secondary';
			case 'todo':
			case 'backlog': return 'outline';
			default: return 'outline';
		}
	}

	function getPriorityBadgeVariant(priority: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (priority) {
			case 'urgent': return 'destructive';
			case 'high': return 'default';
			case 'medium': return 'secondary';
			case 'low': return 'outline';
			default: return 'outline';
		}
	}

	function formatStatus(s: string): string {
		return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
	}

	function formatDate(date: string | Date): string {
		return new Date(date).toLocaleDateString();
	}

	function getInitials(firstName: string, lastName: string): string {
		return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Tasks</h1>
			<p class="text-muted-foreground">Manage tasks across all projects</p>
		</div>
		<Button onclick={openNewTaskModal}>
			<Plus class="mr-2 h-4 w-4" />
			New Task
		</Button>
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

		{#if data.isAdmin}
			<Select.Root
				type="single"
				value={data.filters.status}
				onValueChange={(v) => updateFilter('status', v)}
			>
				<Select.Trigger class="w-[160px]">
					{availableDeletedStatusOptions.find(o => o.value === data.filters.status)?.label || 'Active tasks'}
				</Select.Trigger>
				<Select.Content>
					{#each availableDeletedStatusOptions as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		{/if}

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

		<!-- Sort by -->
		<div class="flex items-center gap-0">
			<Select.Root
				type="single"
				value={data.filters.sortBy}
				onValueChange={(v) => {
					if (v) updateUrl({ sortBy: v, sortOrder: 'asc' });
				}}
			>
				<Select.Trigger class="w-[150px] rounded-r-none border-r-0">
					<ChevronsUpDown class="mr-1 h-4 w-4 shrink-0 text-muted-foreground" />
					{sortByOptions.find(o => o.value === data.filters.sortBy)?.label || 'Name'}
				</Select.Trigger>
				<Select.Content>
					{#each sortByOptions as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<Button
				variant="outline"
				class="px-2 rounded-l-none"
				onclick={() => updateUrl({ sortOrder: data.filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
				title={data.filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
			>
				{#if data.filters.sortOrder === 'asc'}
					<ArrowUp class="h-4 w-4" />
				{:else}
					<ArrowDown class="h-4 w-4" />
				{/if}
			</Button>
		</div>

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

			{#if data.taskTypes.length > 0}
				<Select.Root
					type="single"
					value={data.filters.taskType || 'all'}
					onValueChange={(v) => updateFilter('taskType', v === 'all' ? undefined : v)}
				>
					<Select.Trigger class="w-[160px]">
						{data.filters.taskType ? data.taskTypes.find(t => t.value === data.filters.taskType)?.label || 'Type' : 'All Types'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">All Types</Select.Item>
						{#each data.taskTypes as option}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}

			{#if data.taskCategories.length > 0}
				<Select.Root
					type="single"
					value={data.filters.taskCategory || 'all'}
					onValueChange={(v) => updateFilter('taskCategory', v === 'all' ? undefined : v)}
				>
					<Select.Trigger class="w-[160px]">
						{data.filters.taskCategory ? data.taskCategories.find(c => c.value === data.filters.taskCategory)?.label || 'Category' : 'All Categories'}
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">All Categories</Select.Item>
						{#each data.taskCategories as option}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}
		</div>
	{/if}

	<!-- Table -->
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
				{#if data.tasks.length === 0}
					<Table.Row>
						<Table.Cell colspan={9} class="h-24 text-center">
							No tasks found.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each groupedTasks as group}
						{#if group.label}
							<Table.Row class="bg-muted/50 hover:bg-muted/50">
								<Table.Cell colspan={9} class="py-1.5">
									<span class="font-semibold text-sm">{group.label}</span>
									<span class="text-xs text-muted-foreground ml-2">({group.tasks.length})</span>
								</Table.Cell>
							</Table.Row>
						{/if}
						{#each group.tasks as task}
							<Table.Row
								class="cursor-pointer hover:bg-muted/50 {isTaskDeleted(task) ? 'opacity-60' : ''}"
								onclick={() => openTaskModal(task.id)}
							>
								<Table.Cell>
									<div class="flex flex-col">
										<span class="font-medium truncate max-w-[230px]">
											{task.name}
											{#if isTaskDeleted(task)}
												<span class="text-muted-foreground text-xs ml-1">(deleted)</span>
											{/if}
										</span>
										{#if task.type}
											<span class="text-xs text-muted-foreground">
												{data.taskTypes.find(t => t.value === task.type)?.label || task.type}
											</span>
										{/if}
									</div>
								</Table.Cell>
								<Table.Cell class="text-sm">{task.project.name}</Table.Cell>
								<Table.Cell class="text-sm">{task.project.client.name}</Table.Cell>
								<Table.Cell>
									{#if isTaskDeleted(task)}
										<Badge variant="destructive">Deleted</Badge>
									{:else}
										<Badge variant={getStatusBadgeVariant(task.status)}>
											{formatStatus(task.status)}
										</Badge>
									{/if}
								</Table.Cell>
								<Table.Cell>
									<Badge variant={getPriorityBadgeVariant(task.priority)}>
										{formatStatus(task.priority)}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									{#if task.assignedTo}
										<div class="flex items-center gap-1.5">
											<Avatar.Root class="h-6 w-6">
												<Avatar.Fallback class="text-[9px]">
													{getInitials(task.assignedTo.firstName, task.assignedTo.lastName)}
												</Avatar.Fallback>
											</Avatar.Root>
											<span class="text-sm truncate max-w-[100px]">
												{task.assignedTo.firstName} {task.assignedTo.lastName}
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
								<Table.Cell class="text-sm text-right">
									{#if task.estimatedTime}
										{Number(task.estimatedTime).toFixed(1)}h
									{:else}
										-
									{/if}
									/
									{task.spentTime.toFixed(1)}h
								</Table.Cell>
								<Table.Cell>
									<div class="flex items-center gap-1">
										{#if isTaskDeleted(task)}
											{#if data.isAdmin}
												<Button
													variant="ghost"
													size="icon"
													class="h-8 w-8"
													onclick={(e) => confirmRestore({ id: task.id, name: task.name }, e)}
													title="Restore task"
												>
													<RotateCcw class="h-4 w-4" />
												</Button>
											{/if}
										{:else}
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8"
												onclick={(e) => confirmDelete({ id: task.id, name: task.name }, e)}
												title="Delete task"
											>
												<Trash2 class="h-4 w-4" />
											</Button>
										{/if}
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	<!-- Pagination -->
	{#if data.pagination.totalPages > 1}
		<div class="flex items-center justify-between">
			<p class="text-sm text-muted-foreground">
				Showing {(data.pagination.page - 1) * data.pagination.limit + 1} to {Math.min(
					data.pagination.page * data.pagination.limit,
					data.pagination.total
				)} of {data.pagination.total} tasks
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

<!-- Task Detail Modal -->
<TaskDetailModal
	bind:open={modalOpen}
	onOpenChange={(v) => modalOpen = v}
	taskId={modalTaskId}
	projects={data.projects}
	employees={data.employees}
	taskTypes={data.taskTypes}
	taskCategories={data.taskCategories}
	taskStatuses={data.taskStatuses}
	taskPriorities={data.taskPriorities}
	availableTags={data.availableTags}
	timeRecordTypes={data.timeRecordTypes}
	timeRecordCategories={data.timeRecordCategories}
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
				Are you sure you want to delete <strong>{taskToDelete?.name}</strong>? This action can be
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
			<AlertDialog.Title>Restore Task</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to restore <strong>{taskToRestore?.name}</strong>?
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
