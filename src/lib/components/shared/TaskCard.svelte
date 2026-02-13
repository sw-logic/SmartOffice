<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import UserAvatar from '$lib/components/shared/UserAvatar.svelte';
	import { timer } from '$stores/timer';
	import { Calendar, Clock, Timer } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';

	interface EnumOption {
		value: string;
		label: string;
		color?: string | null;
	}

	interface TaskTag {
		label: string;
		color: string | null;
	}

	interface Props {
		task: {
			id: number;
			name: string;
			priority: string;
			type: string | null;
			dueDate: string | Date | null;
			estimatedTime: number | null;
			spentTime: number;
			assignedTo: { id: number; firstName: string | null; lastName: string | null; image?: string | null } | null;
			tags?: TaskTag[];
		};
		priorityEnums?: EnumOption[];
		onclick?: () => void;
	}

	let { task, priorityEnums, onclick }: Props = $props();

	let priorityColor = $derived(priorityEnums?.find(e => e.value === task.priority)?.color || '#D1D5DB');


	function formatDuration(minutes: number): string {
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		if (h === 0) return `${m}m`;
		if (m === 0) return `${h}h`;
		return `${h}h ${m}m`;
	}

	let hasTime = $derived(task.spentTime > 0 || task.estimatedTime != null);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="rounded-sm border bg-card shadow-sm p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-[3px]"
	style="border-left-color: {priorityColor}"
	{onclick}
>
	<p class="text-sm font-medium leading-snug">{task.name}</p>
	{#if task.tags?.length}
		<div class="flex flex-wrap gap-1 mt-1">
			{#each task.tags as tag}
				<span
					class="text-[10px] uppercase px-1 py-0 rounded border font-medium"
					style={tag.color ? `border-color: ${tag.color}; color: ${tag.color}` : ''}
				>{tag.label}</span>
			{/each}
		</div>
	{/if}
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
			{#if hasTime}
				<span class="text-[11px] text-muted-foreground flex items-center gap-0.5">
					<Clock class="h-3 w-3" />
					{formatDuration(task.spentTime)}{#if task.estimatedTime != null}/{formatDuration(task.estimatedTime)}{/if}
				</span>
			{/if}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span
				class="text-[11px] flex items-center gap-0.5 cursor-pointer hover:text-primary transition-colors {$timer.isRunning && $timer.taskId === task.id ? 'text-primary' : 'text-muted-foreground'}"
				onclick={(e) => { e.stopPropagation(); timer.start(task.id, task.name); }}
				title={$timer.isRunning && $timer.taskId === task.id ? 'Timer running' : 'Start timer'}
			>
				<Timer class="h-3 w-3" />
			</span>
		</div>
		{#if task.assignedTo}
			<UserAvatar user={task.assignedTo} size="xs" title="{task.assignedTo.firstName} {task.assignedTo.lastName}" class="shrink-0" />
		{/if}
	</div>
</div>
