<script lang="ts">
	import { Calendar, Clock } from 'lucide-svelte';
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
			dueDate?: string | Date | null;
			estimatedTime: number | null;
			project: { name: string; client?: { name: string } };
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

	let clientName = $derived(task.project.client?.name);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="rounded-sm border bg-card shadow-sm px-2 py-1.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-[3px]"
	style="border-left-color: {priorityColor}"
	{onclick}
>
	<p class="text-xs font-medium leading-snug truncate">{task.name}</p>
	{#if task.tags?.length}
		<div class="flex flex-wrap gap-0.5 mt-0.5">
			{#each task.tags as tag}
				<span
					class="text-[9px] leading-tight px-0.5 rounded border font-medium"
					style={tag.color ? `border-color: ${tag.color}; color: ${tag.color}` : ''}
				>{tag.label}</span>
			{/each}
		</div>
	{/if}
	<div class="flex items-center gap-2 mt-0.5">
        <span class="text-[10px] text-muted-foreground mt-0.5 truncate">
            {#if clientName}
                <span>{clientName} / </span>
            {/if}
            <span>{task.project.name}</span>
        </span>
		{#if task.dueDate}
			<span class="text-[10px] text-muted-foreground flex items-center gap-0.5">
				<Calendar class="h-2.5 w-2.5" />
				{formatDate(task.dueDate)}
			</span>
		{/if}
		{#if task.estimatedTime}
			<span class="text-[10px] text-muted-foreground flex items-center gap-0.5">
				<Clock class="h-2.5 w-2.5" />
				{formatDuration(task.estimatedTime)}
			</span>
		{/if}
	</div>
</div>
