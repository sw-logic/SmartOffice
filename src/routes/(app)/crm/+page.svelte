<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import LeadCard from '$lib/components/shared/LeadCard.svelte';
	import { toast } from 'svelte-sonner';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { LEAD_STAGES } from '$lib/config/lead-stages';
	import { Plus } from 'lucide-svelte';

	let { data } = $props();

	// Track drag state to distinguish clicks from drags
	let isDragging = $state(false);

	const flipDurationMs = 200;

	type LeadItem = {
		id: number;
		title: string;
		stage: string;
		order: number;
		clientName: string | null;
		budget: number | null;
		currency: string | null;
		deadline: string | Date | null;
		assignedTo: { id: number; firstName: string | null; lastName: string | null; image?: string | null } | null;
	};

	// Group leads by stage
	let stageLeads = $state<Record<string, LeadItem[]>>({});

	$effect(() => {
		const grouped: Record<string, LeadItem[]> = {};
		for (const stage of LEAD_STAGES) {
			grouped[stage.value] = [];
		}
		for (const lead of data.leads) {
			if (grouped[lead.stage]) {
				grouped[lead.stage].push({ ...lead });
			}
		}
		// Sort each stage by order
		for (const key of Object.keys(grouped)) {
			grouped[key].sort((a, b) => a.order - b.order);
		}
		stageLeads = grouped;
	});

	function stageCount(stage: string): number {
		return stageLeads[stage]?.length ?? 0;
	}

	// DnD handlers
	function handleDndConsider(stage: string, e: CustomEvent<{ items: LeadItem[] }>) {
		isDragging = true;
		stageLeads[stage] = e.detail.items;
	}

	async function handleDndFinalize(stage: string, e: CustomEvent<{ items: LeadItem[] }>) {
		setTimeout(() => { isDragging = false; }, 0);
		stageLeads[stage] = e.detail.items;

		const updates: Array<{ id: number; stage: string; order: number }> = [];

		for (const [stageKey, leads] of Object.entries(stageLeads)) {
			for (let i = 0; i < leads.length; i++) {
				const lead = leads[i];
				if (lead.stage !== stageKey || lead.order !== i) {
					lead.stage = stageKey;
					lead.order = i;
					updates.push({ id: lead.id, stage: stageKey, order: i });
				}
			}
		}

		if (updates.length === 0) return;

		const formData = new FormData();
		formData.append('updates', JSON.stringify(updates));

		try {
			const response = await fetch('?/reorderLeads', { method: 'POST', body: formData });
			const result = await response.json();
			if (result.type !== 'success') {
				toast.error('Failed to move lead');
				invalidateAll();
			}
		} catch {
			toast.error('Failed to move lead');
			invalidateAll();
		}
	}

	let gridTemplate = $derived(
		`repeat(${LEAD_STAGES.length}, minmax(200px, 1fr))`
	);
</script>

<div class="flex flex-col h-full gap-3">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">CRM Pipeline</h1>
			<p class="text-muted-foreground">Track leads through your sales pipeline</p>
		</div>
		{#if data.canCreate}
			<Button href="/crm/new">
				<Plus class="mr-1 h-4 w-4" />
				New Lead
			</Button>
		{/if}
	</div>

	<!-- Pipeline board -->
	<div class="flex-1 overflow-auto">
		<!-- Sticky column headers -->
		<div
			class="grid gap-px sticky top-0 z-10 bg-muted"
			style="grid-template-columns: {gridTemplate}"
		>
			{#each LEAD_STAGES as stage}
				<div
					class="bg-background p-2 flex items-center gap-1.5"
					style="border-top: 3px solid {stage.color}"
				>
					<span class="text-sm font-semibold truncate">{stage.label}</span>
					<Badge variant="secondary" class="ml-auto text-xs shrink-0">
						{stageCount(stage.value)}
					</Badge>
				</div>
			{/each}
		</div>

		<!-- Columns -->
		<div
			class="grid gap-px bg-muted"
			style="grid-template-columns: {gridTemplate}"
		>
			{#each LEAD_STAGES as stage}
				<div class="bg-background flex flex-col min-h-[200px]">
					<div
						class="p-2 flex-1 flex flex-col gap-1.5"
						use:dndzone={{
							items: stageLeads[stage.value] || [],
							flipDurationMs,
							dropTargetStyle: {
								outline: '2px dashed hsl(var(--primary) / 0.3)',
								'outline-offset': '-2px',
								'border-radius': '4px'
							}
						}}
						onconsider={(e) => handleDndConsider(stage.value, e)}
						onfinalize={(e) => handleDndFinalize(stage.value, e)}
					>
						{#each stageLeads[stage.value] || [] as lead (lead.id)}
							<div animate:flip={{ duration: flipDurationMs }}>
								<LeadCard
									{lead}
									stageColor={stage.color}
									onclick={() => { if (!isDragging) goto(`/crm/${lead.id}`); }}
								/>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
