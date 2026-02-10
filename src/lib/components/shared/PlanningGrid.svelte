<script lang="ts">
	import PlanningTaskCard from './PlanningTaskCard.svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { format, isSameDay } from 'date-fns';

	interface EnumOption {
		value: string;
		label: string;
		color?: string | null;
	}

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
		project: { name: string };
	}

	interface Employee {
		id: number;
		firstName: string | null;
		lastName: string | null;
		image?: string | null;
	}

	interface Props {
		tasks: PlanningTask[];
		employees: Employee[];
		days: Date[];
		priorityEnums: EnumOption[];
		onTaskMoved: (taskId: number, newStartDate: string | null, newAssigneeId: number | null) => void;
		onTaskClick: (taskId: number) => void;
	}

	let { tasks, employees, days, priorityEnums, onTaskMoved, onTaskClick }: Props = $props();

	const flipDurationMs = 150;
	let isDragging = $state(false);

	type DndItem = PlanningTask & { id: number };

	// Build cell tasks: keyed by `${personId}_${dateISO}`
	let cellTasks = $state<Record<string, DndItem[]>>({});

	$effect(() => {
		const grid: Record<string, DndItem[]> = {};

		// Init cells for each employee x day + unassigned row
		const personIds = [...employees.map(e => e.id), 0]; // 0 = unassigned
		for (const pid of personIds) {
			for (const day of days) {
				const key = `${pid}_${format(day, 'yyyy-MM-dd')}`;
				grid[key] = [];
			}
		}

		for (const task of tasks) {
			if (!task.startDate) continue;
			const taskDate = new Date(task.startDate);
			const matchDay = days.find(d => isSameDay(d, taskDate));
			if (!matchDay) continue;
			const pid = task.assignedToId ?? 0;
			const key = `${pid}_${format(matchDay, 'yyyy-MM-dd')}`;
			if (grid[key]) {
				grid[key].push({ ...task });
			}
		}

		cellTasks = grid;
	});

	function getInitials(firstName: string | null, lastName: string | null): string {
		return `${(firstName ?? '').charAt(0)}${(lastName ?? '').charAt(0)}`.toUpperCase();
	}

	function formatMinutes(minutes: number): string {
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		if (h === 0) return `${m}m`;
		if (m === 0) return `${h}h`;
		return `${h}h ${m}m`;
	}

	function getCellMinutes(cellKey: string): number {
		return (cellTasks[cellKey] || []).reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
	}

	function getPersonWeeklyMinutes(personId: number): number {
		let total = 0;
		for (const day of days) {
			const key = `${personId}_${format(day, 'yyyy-MM-dd')}`;
			total += getCellMinutes(key);
		}
		return total;
	}

	function isToday(day: Date): boolean {
		return isSameDay(day, new Date());
	}

	function handleConsider(cellKey: string, e: CustomEvent<{ items: DndItem[] }>) {
		isDragging = true;
		cellTasks[cellKey] = e.detail.items;
	}

	function handleFinalize(cellKey: string, e: CustomEvent<{ items: DndItem[] }>) {
		setTimeout(() => { isDragging = false; }, 0);
		cellTasks[cellKey] = e.detail.items;

		// Parse the cell key to get personId and date
		const [pidStr, dateISO] = cellKey.split('_');
		const personId = parseInt(pidStr);

		// Find tasks that were moved to this cell
		for (const task of e.detail.items) {
			const oldPid = task.assignedToId ?? 0;
			const oldDate = task.startDate ? format(new Date(task.startDate), 'yyyy-MM-dd') : null;

			if (oldPid !== personId || oldDate !== dateISO) {
				onTaskMoved(
					task.id,
					dateISO,
					personId === 0 ? null : personId
				);
			}
		}
	}

	let dayCount = $derived(days.length);

	let hasUnassignedTasks = $derived(
		tasks.some(t => t.assignedToId == null && t.startDate != null &&
			days.some(d => isSameDay(d, new Date(t.startDate!))))
	);
</script>

<div class="overflow-auto border rounded-md bg-background">
	<!-- Grid -->
	<div
		class="grid min-w-fit"
		style="grid-template-columns: 180px repeat({dayCount}, minmax(150px, 1fr));"
	>
		<!-- Header row -->
		<div class="sticky left-0 z-20 bg-muted/50 border-b border-r p-2 font-medium text-sm">
			Team
		</div>
		{#each days as day}
			<div
				class="border-b border-r p-2 text-center text-sm {isToday(day) ? 'bg-primary/5' : 'bg-muted/50'}"
			>
				<div class="font-medium">{format(day, 'EEE')}</div>
				<div class="text-xs text-muted-foreground">{format(day, 'MMM d')}</div>
			</div>
		{/each}

		<!-- Employee rows -->
		{#each employees as employee}
			{@const weeklyMinutes = getPersonWeeklyMinutes(employee.id)}
			<!-- Person label -->
			<div class="sticky left-0 z-10 bg-background border-b border-r p-2 flex items-center gap-2">
				<Avatar.Root class="h-6 w-6 shrink-0">
					{#if employee.image}
						<Avatar.Image src="/api/uploads/{employee.image}" alt="{employee.firstName} {employee.lastName}" />
					{/if}
					<Avatar.Fallback class="text-[10px]">
						{getInitials(employee.firstName, employee.lastName)}
					</Avatar.Fallback>
				</Avatar.Root>
				<div class="min-w-0">
					<div class="text-xs font-medium truncate">{employee.firstName} {employee.lastName}</div>
					{#if weeklyMinutes > 0}
						<div class="text-xs text-muted-foreground">{formatMinutes(weeklyMinutes)}/week</div>
					{/if}
				</div>
			</div>

			<!-- Day cells for this employee -->
			{#each days as day}
				{@const cellKey = `${employee.id}_${format(day, 'yyyy-MM-dd')}`}
				{@const cellMin = getCellMinutes(cellKey)}
				{@const overloaded = cellMin > 480}
				<div
					class="border-b border-r min-h-[80px] {isToday(day) ? 'bg-primary/5' : ''} {overloaded ? 'bg-destructive/5' : ''}"
				>
					{#if cellMin > 0}
						<div class="px-1.5 pt-1 text-[10px] {overloaded ? 'text-destructive font-medium' : 'text-muted-foreground'} text-right">
							{formatMinutes(cellMin)}
						</div>
					{/if}
					<div
						class="p-1 flex flex-col gap-1 min-h-[60px]"
						use:dndzone={{
							items: cellTasks[cellKey] || [],
							flipDurationMs,
							dropTargetStyle: {
								outline: '2px dashed hsl(var(--primary) / 0.3)',
								'outline-offset': '-2px',
								'border-radius': '4px'
							}
						}}
						onconsider={(e) => handleConsider(cellKey, e)}
						onfinalize={(e) => handleFinalize(cellKey, e)}
					>
						{#each cellTasks[cellKey] || [] as task (task.id)}
							<div animate:flip={{ duration: flipDurationMs }}>
								<PlanningTaskCard
									{task}
									{priorityEnums}
									onclick={() => { if (!isDragging) onTaskClick(task.id); }}
								/>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		{/each}

		<!-- Unassigned row (only shown when there are unassigned tasks) -->
		{#if hasUnassignedTasks}
			{@const unassignedWeekly = getPersonWeeklyMinutes(0)}
			<div class="sticky left-0 z-10 bg-muted/30 border-b border-r p-2 flex items-center gap-2">
				<Avatar.Root class="h-6 w-6 shrink-0">
					<Avatar.Fallback class="text-[10px] bg-muted">?</Avatar.Fallback>
				</Avatar.Root>
				<div class="min-w-0">
					<div class="text-xs font-medium text-muted-foreground">Unassigned</div>
					{#if unassignedWeekly > 0}
						<div class="text-[10px] text-muted-foreground">{formatMinutes(unassignedWeekly)}/week</div>
					{/if}
				</div>
			</div>
			{#each days as day}
				{@const cellKey = `0_${format(day, 'yyyy-MM-dd')}`}
				{@const cellMin = getCellMinutes(cellKey)}
				<div class="border-b border-r min-h-[80px] bg-muted/10 {isToday(day) ? 'bg-primary/5' : ''}">
					{#if cellMin > 0}
						<div class="px-1.5 pt-1 text-[10px] text-muted-foreground text-right">
							{formatMinutes(cellMin)}
						</div>
					{/if}
					<div
						class="p-1 flex flex-col gap-1 min-h-[60px]"
						use:dndzone={{
							items: cellTasks[cellKey] || [],
							flipDurationMs,
							dropTargetStyle: {
								outline: '2px dashed hsl(var(--primary) / 0.3)',
								'outline-offset': '-2px',
								'border-radius': '4px'
							}
						}}
						onconsider={(e) => handleConsider(cellKey, e)}
						onfinalize={(e) => handleFinalize(cellKey, e)}
					>
						{#each cellTasks[cellKey] || [] as task (task.id)}
							<div animate:flip={{ duration: flipDurationMs }}>
								<PlanningTaskCard
									{task}
									{priorityEnums}
									onclick={() => { if (!isDragging) onTaskClick(task.id); }}
								/>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>
