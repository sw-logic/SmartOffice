<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Calendar, Clock } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';

	interface Props {
		task: {
			id: number;
			name: string;
			priority: string;
			type: string | null;
			dueDate: string | Date | null;
			estimatedTime: number | null;
			spentTime: number;
			assignedTo: { id: number; firstName: string; lastName: string } | null;
		};
		onclick?: () => void;
	}

	let { task, onclick }: Props = $props();

	function getPriorityColor(priority: string): string {
		switch (priority) {
			case 'urgent': return 'border-l-red-600';
			case 'high': return 'border-l-orange-500';
			case 'medium': return 'border-l-blue-500';
			case 'low': return 'border-l-gray-400';
			default: return 'border-l-gray-300';
		}
	}

	function getInitials(firstName: string, lastName: string): string {
		return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
	}

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
	class="rounded-sm border bg-card shadow-sm p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-[3px] {getPriorityColor(task.priority)}"
	{onclick}
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
			{#if hasTime}
				<span class="text-[11px] text-muted-foreground flex items-center gap-0.5">
					<Clock class="h-3 w-3" />
					{formatDuration(task.spentTime)}{#if task.estimatedTime != null}/{formatDuration(task.estimatedTime)}{/if}
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
