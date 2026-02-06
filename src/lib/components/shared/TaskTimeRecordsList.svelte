<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';
	import { Plus } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface TimeRecord {
		id: number;
		date: string | Date;
		hours: number | string;
		description: string | null;
		type: string | null;
		category: string | null;
		createdById: string;
		createdBy: { id: string; name: string };
		createdAt: string | Date;
	}

	interface EnumOption {
		value: string;
		label: string;
	}

	interface Props {
		taskId: number;
		timeRecords: TimeRecord[];
		typeOptions: EnumOption[];
		categoryOptions: EnumOption[];
		onTimeRecordsChange: (records: TimeRecord[]) => void;
	}

	let { taskId, timeRecords, typeOptions, categoryOptions, onTimeRecordsChange }: Props = $props();

	let date = $state(new Date().toISOString().slice(0, 10));
	let hours = $state('');
	let description = $state('');
	let type = $state('');
	let category = $state('');
	let isSubmitting = $state(false);

	let totalHours = $derived(
		timeRecords.reduce((sum, tr) => sum + Number(tr.hours), 0)
	);

	async function handleSubmit() {
		if (!date || !hours || Number(hours) <= 0 || isSubmitting) return;
		isSubmitting = true;

		try {
			const res = await fetch(`/api/tasks/${taskId}/time-records`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					date,
					hours: Number(hours),
					description: description.trim() || null,
					type: type || null,
					category: category || null
				})
			});

			if (res.ok) {
				const { timeRecord } = await res.json();
				onTimeRecordsChange([timeRecord, ...timeRecords]);
				hours = '';
				description = '';
				toast.success('Time record added');
			} else {
				const data = await res.json();
				toast.error(data.error || 'Failed to add time record');
			}
		} catch {
			toast.error('Failed to add time record');
		} finally {
			isSubmitting = false;
		}
	}

	function formatDate(d: string | Date): string {
		return new Date(d).toLocaleDateString();
	}
</script>

<div class="space-y-4">
	<div class="rounded-lg border p-3 space-y-3">
		<div class="flex flex-wrap gap-2">
			<Input
				type="date"
				bind:value={date}
				class="w-[140px] h-8 text-sm"
			/>
			<Input
				type="number"
				step="0.25"
				min="0"
				placeholder="Hours"
				bind:value={hours}
				class="w-[80px] h-8 text-sm"
			/>
			<Input
				type="text"
				placeholder="Description"
				bind:value={description}
				class="flex-1 min-w-[120px] h-8 text-sm"
			/>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if typeOptions.length > 0}
				<Select.Root type="single" value={type} onValueChange={(v) => { if (v) type = v; }}>
					<Select.Trigger class="w-[130px] h-8 text-xs">
						{typeOptions.find(o => o.value === type)?.label || 'Type'}
					</Select.Trigger>
					<Select.Content>
						{#each typeOptions as option}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}
			{#if categoryOptions.length > 0}
				<Select.Root type="single" value={category} onValueChange={(v) => { if (v) category = v; }}>
					<Select.Trigger class="w-[130px] h-8 text-xs">
						{categoryOptions.find(o => o.value === category)?.label || 'Category'}
					</Select.Trigger>
					<Select.Content>
						{#each categoryOptions as option}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}
			<div class="flex-1"></div>
			<Button
				size="sm"
				onclick={handleSubmit}
				disabled={!date || !hours || Number(hours) <= 0 || isSubmitting}
			>
				<Plus class="mr-1 h-3 w-3" />
				{isSubmitting ? 'Adding...' : 'Add'}
			</Button>
		</div>
	</div>

	{#if timeRecords.length === 0}
		<p class="text-sm text-muted-foreground text-center py-4">No time records yet.</p>
	{:else}
		<div class="rounded-md border">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Date</Table.Head>
						<Table.Head class="text-right">Hours</Table.Head>
						<Table.Head>Description</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head>By</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each timeRecords as record (record.id)}
						<Table.Row>
							<Table.Cell class="text-sm">{formatDate(record.date)}</Table.Cell>
							<Table.Cell class="text-sm text-right font-medium">{Number(record.hours).toFixed(2)}</Table.Cell>
							<Table.Cell class="text-sm">{record.description || '-'}</Table.Cell>
							<Table.Cell class="text-sm">
								{#if record.type}
									{typeOptions.find(o => o.value === record.type)?.label || record.type}
								{:else}
									-
								{/if}
							</Table.Cell>
							<Table.Cell class="text-sm">{record.createdBy.name}</Table.Cell>
						</Table.Row>
					{/each}
					<Table.Row class="font-medium bg-muted/50">
						<Table.Cell>Total</Table.Cell>
						<Table.Cell class="text-right">{totalHours.toFixed(2)}</Table.Cell>
						<Table.Cell colspan={3}></Table.Cell>
					</Table.Row>
				</Table.Body>
			</Table.Root>
		</div>
	{/if}
</div>
