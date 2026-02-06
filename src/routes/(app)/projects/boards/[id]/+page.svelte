<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Alert from '$lib/components/ui/alert';
	import * as Select from '$lib/components/ui/select';
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import * as Avatar from '$lib/components/ui/avatar';
	import { toast } from 'svelte-sonner';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import {
		ArrowLeft,
		AlertTriangle,
		SearchIcon,
		ChevronDown,
		ChevronRight,
		Calendar,
		Plus
	} from 'lucide-svelte';

	let { data } = $props();

	// Navigation state
	let selectedClientId = $state<number | null>(data.board.clientId);
	let searchOpen = $state(false);
	let searchQuery = $state('');

	// Collapse state
	let collapsedColumns = $state<Set<number>>(new Set());
	let collapsedSwimlanes = $state<Set<number>>(new Set());

	// DnD
	const flipDurationMs = 200;

	type TaskItem = {
		id: number;
		name: string;
		status: string;
		priority: string;
		type: string | null;
		columnId: number | null;
		swimlaneId: number | null;
		order: number;
		dueDate: string | Date | null;
		assignedTo: { id: number; firstName: string; lastName: string } | null;
	};

	// Grid: cellTasks[swimlaneId][columnId] = TaskItem[]
	let cellTasks = $state<Record<number, Record<number, TaskItem[]>>>({});

	$effect(() => {
		const grid: Record<number, Record<number, TaskItem[]>> = {};
		for (const sl of data.board.swimlanes) {
			grid[sl.id] = {};
			for (const col of data.board.columns) {
				grid[sl.id][col.id] = [];
			}
		}
		for (const task of data.board.tasks) {
			if (task.columnId && task.swimlaneId && grid[task.swimlaneId]?.[task.columnId]) {
				grid[task.swimlaneId][task.columnId].push({ ...task });
			}
		}
		for (const slId of Object.keys(grid)) {
			for (const colId of Object.keys(grid[Number(slId)])) {
				grid[Number(slId)][Number(colId)].sort((a, b) => a.order - b.order);
			}
		}
		cellTasks = grid;
	});

	// Visible (non-collapsed) columns
	let visibleColumns = $derived(
		data.board.columns.filter(c => !collapsedColumns.has(c.id))
	);

	// Grid template: equal fractions for visible columns, auto for collapsed
	let gridTemplate = $derived(() => {
		return data.board.columns
			.map(c => collapsedColumns.has(c.id) ? '36px' : 'minmax(200px, 1fr)')
			.join(' ');
	});

	// DnD handlers
	function handleDndConsider(swimlaneId: number, columnId: number, e: CustomEvent<{ items: TaskItem[] }>) {
		cellTasks[swimlaneId][columnId] = e.detail.items;
	}

	async function handleDndFinalize(swimlaneId: number, columnId: number, e: CustomEvent<{ items: TaskItem[] }>) {
		cellTasks[swimlaneId][columnId] = e.detail.items;

		const updates: Array<{ id: number; columnId: number; swimlaneId: number; order: number }> = [];

		for (const [slId, columns] of Object.entries(cellTasks)) {
			for (const [colId, tasks] of Object.entries(columns)) {
				for (let i = 0; i < tasks.length; i++) {
					const task = tasks[i];
					if (
						task.columnId !== Number(colId) ||
						task.swimlaneId !== Number(slId) ||
						task.order !== i
					) {
						task.columnId = Number(colId);
						task.swimlaneId = Number(slId);
						task.order = i;
						updates.push({
							id: task.id,
							columnId: Number(colId),
							swimlaneId: Number(slId),
							order: i
						});
					}
				}
			}
		}

		if (updates.length === 0) return;

		const formData = new FormData();
		formData.append('updates', JSON.stringify(updates));

		try {
			const response = await fetch('?/reorderTasks', { method: 'POST', body: formData });
			const result = await response.json();
			if (result.type !== 'success') {
				toast.error('Failed to move task');
				invalidateAll();
			}
		} catch {
			toast.error('Failed to move task');
			invalidateAll();
		}
	}

	function toggleColumn(columnId: number) {
		const next = new Set(collapsedColumns);
		if (next.has(columnId)) next.delete(columnId);
		else next.add(columnId);
		collapsedColumns = next;
	}

	function toggleSwimlane(swimlaneId: number) {
		const next = new Set(collapsedSwimlanes);
		if (next.has(swimlaneId)) next.delete(swimlaneId);
		else next.add(swimlaneId);
		collapsedSwimlanes = next;
	}

	function swimlaneTaskCount(swimlaneId: number): number {
		if (!cellTasks[swimlaneId]) return 0;
		return Object.values(cellTasks[swimlaneId]).reduce((sum, tasks) => sum + tasks.length, 0);
	}

	function columnTaskCount(columnId: number): number {
		let count = 0;
		for (const columns of Object.values(cellTasks)) {
			count += (columns[columnId] || []).length;
		}
		return count;
	}

	// Navigation helpers
	let filteredBoards = $derived(
		selectedClientId
			? data.allBoards.filter(b => b.clientId === selectedClientId)
			: data.allBoards
	);

	let searchedBoards = $derived(() => {
		if (!searchQuery) return data.allBoards;
		const q = searchQuery.toLowerCase();
		return data.allBoards.filter(
			b => b.name.toLowerCase().includes(q) || b.projectName.toLowerCase().includes(q)
		);
	});

	let searchGrouped = $derived(() => {
		const boards = searchedBoards();
		const groups: Record<string, typeof data.allBoards> = {};
		for (const board of boards) {
			if (!groups[board.clientName]) groups[board.clientName] = [];
			groups[board.clientName].push(board);
		}
		return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
	});

	function handleClientChange(value: string | undefined) {
		if (!value || value === 'all') {
			selectedClientId = null;
		} else {
			const clientId = parseInt(value);
			selectedClientId = isNaN(clientId) ? null : clientId;
			const matching = data.allBoards.filter(b => b.clientId === clientId);
			if (matching.length > 0 && !matching.some(b => b.id === data.board.id)) {
				goto(`/projects/boards/${matching[0].id}`);
			}
		}
	}

	function handleBoardChange(value: string | undefined) {
		if (!value) return;
		const boardId = parseInt(value);
		if (!isNaN(boardId) && boardId !== data.board.id) {
			goto(`/projects/boards/${boardId}`);
		}
	}

	function handleSearchSelect(boardId: number) {
		searchOpen = false;
		searchQuery = '';
		if (boardId !== data.board.id) goto(`/projects/boards/${boardId}`);
	}

	function getInitials(firstName: string, lastName: string): string {
		return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
	}

	function getPriorityColor(priority: string): string {
		switch (priority) {
			case 'urgent': return 'border-l-red-600';
			case 'high': return 'border-l-orange-500';
			case 'medium': return 'border-l-blue-500';
			case 'low': return 'border-l-gray-400';
			default: return 'border-l-gray-300';
		}
	}

	function formatDate(date: string | Date): string {
		return new Date(date).toLocaleDateString();
	}
</script>

<div class="flex flex-col h-full gap-3">
	<!-- Navigation bar -->
	<div class="flex items-center gap-3 flex-wrap">
		<Button variant="ghost" size="icon" href="/projects/boards">
			<ArrowLeft class="h-4 w-4" />
		</Button>

		<Select.Root
			type="single"
			value={selectedClientId ? String(selectedClientId) : 'all'}
			onValueChange={handleClientChange}
		>
			<Select.Trigger class="w-[200px]">
				{selectedClientId
					? data.allClients.find(c => c.id === selectedClientId)?.name || 'All Clients'
					: 'All Clients'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="all">All Clients</Select.Item>
				{#each data.allClients as client}
					<Select.Item value={String(client.id)}>{client.name}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Select.Root
			type="single"
			value={String(data.board.id)}
			onValueChange={handleBoardChange}
		>
			<Select.Trigger class="w-[250px]">
				{data.board.name}
			</Select.Trigger>
			<Select.Content>
				{#each filteredBoards as board}
					<Select.Item value={String(board.id)}>
						{board.name}
						<span class="text-muted-foreground ml-1 text-xs">({board.projectName})</span>
					</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Popover.Root bind:open={searchOpen}>
			<Popover.Trigger>
				<Button variant="outline" size="sm" class="gap-2">
					<SearchIcon class="h-4 w-4" />
					Search boards...
				</Button>
			</Popover.Trigger>
			<Popover.Content class="w-72 p-0" align="start">
				<Command.Root>
					<Command.Input placeholder="Search boards..." bind:value={searchQuery} />
					<Command.List>
						<Command.Empty>No boards found.</Command.Empty>
						{#each searchGrouped() as [clientName, boards]}
							<Command.Group heading={clientName}>
								{#each boards as board (board.id)}
									<Command.Item
										value="{board.name} {board.projectName}"
										onSelect={() => handleSearchSelect(board.id)}
									>
										<div class="flex flex-col">
											<span class="text-sm">{board.name}</span>
											<span class="text-xs text-muted-foreground">{board.projectName}</span>
										</div>
									</Command.Item>
								{/each}
							</Command.Group>
						{/each}
					</Command.List>
				</Command.Root>
			</Popover.Content>
		</Popover.Root>

		<div class="ml-auto">
			<Button size="sm">
				<Plus class="mr-1 h-4 w-4" />
				New Task
			</Button>
		</div>
	</div>

	{#if data.board.isDeleted}
		<Alert.Root variant="destructive">
			<AlertTriangle class="h-4 w-4" />
			<Alert.Title>Deleted Board</Alert.Title>
			<Alert.Description>
				This board has been deleted. Only administrators can view this record.
			</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Kanban board -->
	{#if data.board.columns.length === 0 || data.board.swimlanes.length === 0}
		<div class="flex-1 flex items-center justify-center text-muted-foreground">
			<p class="text-lg">No columns or swimlanes configured for this board.</p>
		</div>
	{:else}
		<div class="flex-1 overflow-auto">
			<!-- Sticky column headers -->
			<div
				class="grid gap-px sticky top-0 z-10 bg-muted"
				style="grid-template-columns: {gridTemplate()}"
			>
				{#each data.board.columns as column}
					{#if collapsedColumns.has(column.id)}
						<div class="bg-background p-1 flex items-center justify-center">
							<button
								type="button"
								class="p-0.5 rounded hover:bg-muted"
								onclick={() => toggleColumn(column.id)}
								title="Expand {column.name}"
							>
								<ChevronRight class="h-3.5 w-3.5 text-muted-foreground" />
							</button>
						</div>
					{:else}
						<div
							class="bg-background p-2 flex items-center gap-1.5"
							style={column.color ? `border-top: 3px solid ${column.color}` : ''}
						>
							<button
								type="button"
								class="p-0.5 rounded hover:bg-muted shrink-0"
								onclick={() => toggleColumn(column.id)}
								title="Collapse column"
							>
								<ChevronDown class="h-3.5 w-3.5 text-muted-foreground" />
							</button>
							<span class="text-sm font-semibold truncate">{column.name}</span>
							<Badge variant="secondary" class="ml-auto text-xs shrink-0">
								{columnTaskCount(column.id)}
							</Badge>
						</div>
					{/if}
				{/each}
			</div>

			<!-- Swimlanes — 1px gap between, content drives height -->
			<div class="flex flex-col gap-px bg-muted">
				{#each data.board.swimlanes as swimlane}
					<div class="bg-background">
						<!-- Swimlane header (full width) -->
						<div
							class="flex items-center gap-1.5 px-2 py-1.5 bg-muted/40"
							style={swimlane.color ? `border-left: 3px solid ${swimlane.color}` : ''}
						>
							<button
								type="button"
								class="p-0.5 rounded hover:bg-muted shrink-0"
								onclick={() => toggleSwimlane(swimlane.id)}
								title={collapsedSwimlanes.has(swimlane.id) ? 'Expand swimlane' : 'Collapse swimlane'}
							>
								{#if collapsedSwimlanes.has(swimlane.id)}
									<ChevronRight class="h-3.5 w-3.5 text-muted-foreground" />
								{:else}
									<ChevronDown class="h-3.5 w-3.5 text-muted-foreground" />
								{/if}
							</button>
							<span class="text-sm font-semibold">{swimlane.name}</span>
							<Badge variant="secondary" class="text-xs">{swimlaneTaskCount(swimlane.id)}</Badge>
						</div>

						<!-- Swimlane row (columns grid) -->
						{#if !collapsedSwimlanes.has(swimlane.id)}
							<div
								class="grid gap-px bg-muted"
								style="grid-template-columns: {gridTemplate()}"
							>
								{#each data.board.columns as column}
									{#if collapsedColumns.has(column.id)}
										<div class="bg-background p-3 flex flex-col items-center min-h-[80px]">
											{#if (cellTasks[swimlane.id]?.[column.id]?.length ?? 0) > 0}
												<span class="text-xs text-muted-foreground font-medium mt-1">
													{cellTasks[swimlane.id][column.id].length}
												</span>
											{/if}
										</div>
									{:else}
										<div class="bg-background flex flex-col min-h-[80px]">
											<div
												class="p-3 flex-1 flex flex-col gap-1.5"
												use:dndzone={{
													items: cellTasks[swimlane.id]?.[column.id] || [],
													flipDurationMs,
													dropTargetStyle: {
														outline: '2px dashed hsl(var(--primary) / 0.3)',
														'outline-offset': '-2px',
														'border-radius': '4px'
													}
												}}
												onconsider={(e) => handleDndConsider(swimlane.id, column.id, e)}
												onfinalize={(e) => handleDndFinalize(swimlane.id, column.id, e)}
											>
												{#each cellTasks[swimlane.id]?.[column.id] || [] as task (task.id)}
													<div
														animate:flip={{ duration: flipDurationMs }}
														class="rounded-sm border bg-card shadow-sm p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-[3px] {getPriorityColor(task.priority)}"
													>
														<p class="text-sm font-medium leading-snug">{task.name}</p>
														<div class="flex items-center justify-between mt-1.5 gap-2">
															<div class="flex items-center gap-1.5 flex-wrap">
																{#if task.type}
																	<Badge variant="outline" class="text-[10px] px-1 py-0">{task.type}</Badge>
																{/if}
																{#if task.dueDate}
																	<span class="text-[11px] text-muted-foreground flex items-center gap-0.5">
																		<Calendar class="h-3 w-3" />
																		{formatDate(task.dueDate)}
																	</span>
																{/if}
															</div>
															{#if task.assignedTo}
																<Avatar.Root class="h-5 w-5 shrink-0" title="{task.assignedTo.firstName} {task.assignedTo.lastName}">
																	<Avatar.Fallback class="text-[9px]">
																		{getInitials(task.assignedTo.firstName, task.assignedTo.lastName)}
																	</Avatar.Fallback>
																</Avatar.Root>
															{/if}
														</div>
													</div>
												{/each}
											</div>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
