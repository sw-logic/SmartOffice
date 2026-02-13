<script lang="ts">
	import UserAvatar from '$lib/components/shared/UserAvatar.svelte';
	import { Calendar, DollarSign } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';

	interface Props {
		lead: {
			id: number;
			title: string;
			clientName: string | null;
			budget: number | null;
			currency: string | null;
			deadline: string | Date | null;
			assignedTo: { id: number; firstName: string | null; lastName: string | null; image?: string | null } | null;
		};
		stageColor?: string;
		onclick?: () => void;
	}

	let { lead, stageColor = '#3B82F6', onclick }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="rounded-sm border bg-card shadow-sm p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-[3px]"
	style="border-left-color: {stageColor}"
	{onclick}
>
	<p class="text-sm font-medium leading-snug">{lead.title}</p>
	{#if lead.clientName}
		<p class="text-xs text-muted-foreground mt-0.5 truncate">{lead.clientName}</p>
	{/if}
	<div class="flex items-center justify-between mt-1.5 gap-2">
		<div class="flex items-center gap-1.5 flex-wrap">
			{#if lead.budget != null}
				<span class="text-[11px] text-muted-foreground flex items-center gap-0.5">
					<DollarSign class="h-3 w-3" />
					{lead.budget.toLocaleString()} {lead.currency || ''}
				</span>
			{/if}
			{#if lead.deadline}
				<span class="text-[11px] text-muted-foreground flex items-center gap-0.5">
					<Calendar class="h-3 w-3" />
					{formatDate(lead.deadline)}
				</span>
			{/if}
		</div>
		{#if lead.assignedTo}
			<UserAvatar user={lead.assignedTo} size="xs" title="{lead.assignedTo.firstName ?? ''} {lead.assignedTo.lastName ?? ''}" class="shrink-0" />
		{/if}
	</div>
</div>
