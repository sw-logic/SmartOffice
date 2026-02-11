<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Select from '$lib/components/ui/select';
	import WeekNavigator from '$lib/components/shared/WeekNavigator.svelte';
	import PlanningGrid from '$lib/components/shared/PlanningGrid.svelte';
	import PlanningTaskCard from '$lib/components/shared/PlanningTaskCard.svelte';
	import TaskDetailModal from '$lib/components/shared/TaskDetailModal.svelte';
	import { toast } from 'svelte-sonner';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { saveListState } from '$lib/utils/list-state';
	import { addDays, startOfWeek } from 'date-fns';
	import { CalendarDays, Search } from 'lucide-svelte';

	let { data } = $props();

	// Task modal state
	let modalOpen = $state(false);
	let modalTaskId = $state<number | null>(null);

	// Lazy-loaded modal data
	let modalData = $state<{
		projects: Array<{
			id: number;
			name: string;
			client: { id: number; name: string };
			kanbanBoards: Array<{
				id: number;
				name: string;
				columns: Array<{ id: number; name: string }>;
				swimlanes: Array<{ id: number; name: string }>;
			}>;
		}>;
		employees: Array<{ id: number; firstName: string; lastName: string }>;
		availableTags: Array<{ id: number; value: string; label: string; color: string | null }>;
	} | null>(null);
	let modalDataLoading = $state(false);

	async function ensureModalData(): Promise<boolean> {
		if (modalData) return true;
		if (modalDataLoading) return false;
		modalDataLoading = true;
		try {
			const res = await fetch('/api/tasks/modal-data');
			if (!res.ok) {
				toast.error('Failed to load task data');
				return false;
			}
			modalData = await res.json();
			return true;
		} catch {
			toast.error('Failed to load task data');
			return false;
		} finally {
			modalDataLoading = false;
		}
	}

	async function openTaskModal(taskId: number) {
		modalTaskId = taskId;
		if (await ensureModalData()) {
			modalOpen = true;
		}
	}

	// DnD for task list panel
	const flipDurationMs = 150;
	let isDragging = $state(false);

	interface PlanningTask {
		id: number;
		name: string;
		status: string;
		priority: string;
		type: string | null;
		startDate: string | Date | null;
		dueDate: string | Date | null;
		estimatedTime: number | null;
		spentTime: number;
		assignedToId: number | null;
		assignedTo: { id: number; firstName: string; lastName: string } | null;
		project: { id: number; name: string; client: { id: number; name: string } };
	}

	let unscheduledItems = $state<PlanningTask[]>([]);

	$effect(() => {
		unscheduledItems = data.unscheduledTasks.map(t => ({ ...t }) as any);
	});

	// Local search within unscheduled list
	let taskSearch = $state('');
	let filteredUnscheduled = $derived(
		taskSearch.trim()
			? unscheduledItems.filter(t =>
				t.name.toLowerCase().includes(taskSearch.trim().toLowerCase()) ||
				t.project.name.toLowerCase().includes(taskSearch.trim().toLowerCase())
			)
			: unscheduledItems
	);

	// Compute days array from week start + viewMode
	let days = $derived(() => {
		const weekStart = startOfWeek(new Date(data.filters.week + 'T00:00:00'), { weekStartsOn: 1 });
		const count = data.filters.viewMode === 'fullweek' ? 7 : 5;
		return Array.from({ length: count }, (_, i) => addDays(weekStart, i));
	});

	// Save list state
	$effect(() => {
		const search = $page.url.search;
		if (search) {
			saveListState('/projects/planning', search);
		}
	});

	// Navigation helpers
	function updateFilters(params: Record<string, string>) {
		const url = new URL($page.url);
		for (const [key, value] of Object.entries(params)) {
			if (value) {
				url.searchParams.set(key, value);
			} else {
				url.searchParams.delete(key);
			}
		}
		goto(url.toString(), { replaceState: true });
	}

	function handleWeekChange(newWeek: string) {
		updateFilters({ week: newWeek });
	}

	function handleViewModeChange(mode: 'workweek' | 'fullweek') {
		updateFilters({ viewMode: mode });
	}

	// Move task handler (called from grid and task list panel)
	async function handleTaskMoved(taskId: number, newStartDate: string | null, newAssigneeId: number | null) {
		try {
			const body: Record<string, unknown> = {};
			body.startDate = newStartDate;
			if (newAssigneeId !== undefined) {
				body.assignedToId = newAssigneeId;
			}

			const res = await fetch(`/api/tasks/${taskId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				toast.error('Failed to move task');
				invalidateAll();
			}
		} catch {
			toast.error('Failed to move task');
			invalidateAll();
		}
	}

	// Task list panel DnD handlers
	function handleTaskListConsider(e: CustomEvent<{ items: PlanningTask[] }>) {
		isDragging = true;
		unscheduledItems = e.detail.items;
	}

	function handleTaskListFinalize(e: CustomEvent<{ items: PlanningTask[] }>) {
		setTimeout(() => { isDragging = false; }, 0);
		unscheduledItems = e.detail.items;

		// Check if any task was dropped here that previously had a startDate
		for (const task of e.detail.items) {
			if (task.startDate) {
				// This task was dragged from the grid to the task list — clear startDate
				handleTaskMoved(task.id, null, null);
			}
		}
	}

	let statusEnums = $derived(data.enums?.task_status || []);
</script>

<div class="flex h-full overflow-hidden">
	<!-- LEFT PANEL: Task List with Filters (1/3) -->
	<div class="w-1/5 max-w-[420px] min-w-[300px] shrink-0 flex flex-col border-r bg-background">
		<!-- Panel header -->
		<div class="pr-2 pb-3 border-b space-y-3">
			<div class="flex items-center gap-2">
				<CalendarDays class="h-5 w-5 text-muted-foreground" />
				<h1 class="text-lg font-bold">Resource Planning</h1>
			</div>

			<!-- Filters -->
			<div class="space-y-2">
                <div class="grid grid-cols-2 gap-2">

                    <Select.Root
                        type="single"
                        value={data.filters.projectId || 'all'}
                        onValueChange={(v) => updateFilters({ projectId: v === 'all' ? '' : v })}
                    >
                        <Select.Trigger class="h-8 w-full text-sm">
                            {data.filters.projectId ? data.projects.find(p => p.id === parseInt(data.filters.projectId))?.name || 'Project' : 'All Projects'}
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="all">All Projects</Select.Item>
                            {#each data.projects as project}
                                <Select.Item value={String(project.id)}>
                                    {project.name}
                                    <span class="text-muted-foreground ml-1">({project.client.name})</span>
                                </Select.Item>
                            {/each}
                        </Select.Content>
                    </Select.Root>

					<Select.Root
                        type="single"
						value={data.filters.clientId || 'all'}
						onValueChange={(v) => updateFilters({ clientId: v === 'all' ? '' : v })}
					>
						<Select.Trigger class="w-full h-8 flex-1 text-sm">
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
                        class="w-full"
						type="single"
						value={data.filters.status || 'all'}
						onValueChange={(v) => updateFilters({ status: v === 'all' ? '' : v })}
					>
						<Select.Trigger class="w-full h-8 flex-1 text-sm">
							{data.filters.status
								? statusEnums.find((s: { value: string }) => s.value === data.filters.status)?.label || 'Status'
								: 'All Statuses'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">All Statuses</Select.Item>
							{#each statusEnums as s}
								<Select.Item value={s.value}>{s.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>

                    <Select.Root
                            class="w-full"
                            type="single"
                            value={data.filters.assigneeId || 'all'}
                            onValueChange={(v) => updateFilters({ assigneeId: v === 'all' ? '' : v })}
                    >
                        <Select.Trigger class="h-8 w-full text-sm">
                            {@const emp = data.filters.assigneeId ? data.employees.find(e => e.id === parseInt(data.filters.assigneeId)) : null}
                            {emp ? `${emp.firstName} ${emp.lastName}` : 'All Assignees'}
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="all">All Assignees</Select.Item>
                            {#each data.employees as emp}
                                <Select.Item value={String(emp.id)}>{emp.firstName} {emp.lastName}</Select.Item>
                            {/each}
                        </Select.Content>
                    </Select.Root>
				</div>



				<label class="flex items-center gap-1.5 text-sm cursor-pointer">
					<Checkbox
						checked={data.filters.hideDone}
						onCheckedChange={(checked) => updateFilters({ hideDone: checked ? 'true' : 'false' })}
					/>
					Hide completed
				</label>
			</div>
		</div>

		<!-- Scrollable task list (DnD zone) -->
		<div
			class="flex-1 overflow-y-auto pt-2 pr-2 flex flex-col gap-1.5 min-h-[80px]"
			use:dndzone={{
				items: filteredUnscheduled,
				flipDurationMs,
				dropTargetStyle: {
					outline: '2px dashed hsl(var(--primary) / 0.3)',
					'outline-offset': '-2px',
					'border-radius': '4px'
				}
			}}
			onconsider={(e) => handleTaskListConsider(e)}
			onfinalize={(e) => handleTaskListFinalize(e)}
		>
			{#each filteredUnscheduled as task (task.id)}
				<div animate:flip={{ duration: flipDurationMs }}>
					<PlanningTaskCard
						{task}
						{statusEnums}
						onclick={() => { if (!isDragging) openTaskModal(task.id); }}
					/>
				</div>
			{/each}
			{#if filteredUnscheduled.length === 0}
				<div class="flex items-center justify-center py-8 text-sm text-muted-foreground">
					{taskSearch ? 'No tasks match search' : 'No unscheduled tasks'}
				</div>
			{/if}
		</div>
	</div>

	<!-- RIGHT PANEL: Calendar Grid (2/3) -->
	<div class="flex-1 min-w-0 flex flex-col overflow-hidden">
		<!-- Week navigator bar -->
		<div class="p-2 pt-0 border-b flex items-center">
			<WeekNavigator
				weekStart={data.filters.week}
				viewMode={data.filters.viewMode}
				onWeekChange={handleWeekChange}
				onViewModeChange={handleViewModeChange}
			/>
		</div>

		<!-- Planning grid -->
		<div class="flex-1 min-h-0 overflow-auto p-2">
			<PlanningGrid
				tasks={data.tasks as any}
				employees={data.employees}
				days={days()}
				{statusEnums}
				onTaskMoved={handleTaskMoved}
				onTaskClick={openTaskModal}
			/>
		</div>
	</div>
</div>

{#if modalData}
	<TaskDetailModal
		bind:open={modalOpen}
		onOpenChange={(open) => { modalOpen = open; }}
		taskId={modalTaskId}
		projects={modalData.projects}
		employees={modalData.employees}
		taskTypes={data.enums?.task_type || []}
		taskCategories={data.enums?.task_category || []}
		taskPriorities={data.enums?.priority || []}
		availableTags={modalData.availableTags}
		timeRecordTypes={data.enums?.time_record_type || []}
		timeRecordCategories={data.enums?.time_record_category || []}
		notePriorities={data.enums?.note_priority || []}
		currentUserId={data.user?.id}
		onTaskCreated={() => invalidateAll()}
		onTaskUpdated={() => invalidateAll()}
	/>
{/if}
