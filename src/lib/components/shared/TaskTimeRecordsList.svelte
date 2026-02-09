<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import TimeRecordFormModal from './TimeRecordFormModal.svelte';
	import { Plus, Pencil } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';
    import { Badge } from "$components/ui/badge";

    interface TimeRecord {
		id: number;
		date: string | Date;
		minutes: number;
		description: string | null;
		type: string | null;
		category: string | null;
		billable: boolean;
		userId: number | null;
		user: { id: number; firstName: string; lastName: string } | null;
		createdById: number;
		createdBy: { id: number; name: string };
		createdAt: string | Date;
	}

	interface EnumOption {
		value: string;
		label: string;
	}

	interface PersonOption {
		id: number;
		firstName: string | null;
		lastName: string | null;
	}

	interface Props {
		taskId: number;
		timeRecords: TimeRecord[];
		typeOptions: EnumOption[];
		categoryOptions: EnumOption[];
		employees: PersonOption[];
		currentUserId: number | null;
		onTimeRecordsChange: (records: TimeRecord[]) => void;
	}

	let { taskId, timeRecords, typeOptions, categoryOptions, employees, currentUserId, onTimeRecordsChange }: Props = $props();

	let modalOpen = $state(false);
	let editingRecord = $state<{
		id: number;
		date: string;
		minutes: number;
		description: string | null;
		type: string | null;
		category: string | null;
		billable: boolean;
		userId: number | null;
	} | null>(null);

	let totalMinutes = $derived(
		timeRecords.reduce((sum, tr) => sum + Number(tr.minutes), 0)
	);

	function fmtMin(m: number): string {
		const h = Math.floor(m / 60);
		const min = m % 60;
		return `${h}h ${min}m`;
	}

	function openCreateModal() {
		editingRecord = null;
		modalOpen = true;
	}

	function openEditModal(record: TimeRecord) {
		editingRecord = {
			id: record.id,
			date: new Date(record.date).toISOString().slice(0, 10),
			minutes: Number(record.minutes),
			description: record.description,
			type: record.type,
			category: record.category,
			billable: record.billable,
			userId: record.userId
		};
		modalOpen = true;
	}

	function handleSaved(saved: TimeRecord) {
		if (editingRecord) {
			onTimeRecordsChange(timeRecords.map(r => r.id === saved.id ? saved : r));
			toast.success('Time record updated');
		} else {
			onTimeRecordsChange([saved, ...timeRecords]);
			toast.success('Time record added');
		}
	}

	function handleDeleted(id: number) {
		onTimeRecordsChange(timeRecords.filter(r => r.id !== id));
		toast.success('Time record deleted');
	}

</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<span class="text-sm text-muted-foreground">
			Total: <span class="font-medium text-foreground">{fmtMin(totalMinutes)}</span>
		</span>
		<Button size="sm" variant="outline" onclick={openCreateModal}>
			<Plus class="mr-1 h-3 w-3" />
			Add Time
		</Button>
	</div>

	{#if timeRecords.length === 0}
		<p class="text-sm text-muted-foreground text-center py-4">No time records yet.</p>
	{:else}
		<div class="rounded-md border">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Date</Table.Head>
						<Table.Head class="text-right">Time</Table.Head>
						<Table.Head>Detail</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head class="text-center">Billable</Table.Head>
						<Table.Head class="w-[40px]"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each timeRecords as record (record.id)}
						<Table.Row>
							<Table.Cell class="text-xs">{formatDate(record.date)}</Table.Cell>
							<Table.Cell class="text-sm text-left font-medium">{fmtMin(Number(record.minutes))}</Table.Cell>
							<Table.Cell class="text-sm">
								{#if record.user}
									<div>{record.user.firstName} {record.user.lastName}</div>
								{:else}
									-
								{/if}
                                {#if record.description}
                                    <div class="text-sm truncate">{record.description}</div>
                                {:else}
                                    -
                                {/if}
							</Table.Cell>
							<Table.Cell>
								{#if record.type}
									<Badge variant="outline" class="text-[10px]">{typeOptions.find(o => o.value === record.type)?.label || record.type}</Badge>
								{:else}
									-
								{/if}
							</Table.Cell>
							<Table.Cell class="text-xs text-center">{record.billable ? 'Yes' : 'No'}</Table.Cell>
							<Table.Cell>
								<Button
									size="icon"
									variant="ghost"
									class="h-7 w-7"
									onclick={() => openEditModal(record)}
								>
									<Pencil class="h-3.5 w-3.5" />
								</Button>
							</Table.Cell>
						</Table.Row>
					{/each}
					<Table.Row class="font-medium bg-muted/50">
						<Table.Cell>Total</Table.Cell>
						<Table.Cell class="text-left">{fmtMin(totalMinutes)}</Table.Cell>
						<Table.Cell colspan={5}></Table.Cell>
					</Table.Row>
				</Table.Body>
			</Table.Root>
		</div>
	{/if}
</div>

<TimeRecordFormModal
	bind:open={modalOpen}
	onOpenChange={(v) => { modalOpen = v; if (!v) editingRecord = null; }}
	{taskId}
	record={editingRecord}
	{typeOptions}
	{categoryOptions}
	{employees}
	defaultUserId={currentUserId}
	onSaved={handleSaved}
	onDeleted={handleDeleted}
/>
