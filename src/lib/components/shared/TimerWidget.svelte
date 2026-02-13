<script lang="ts">
	import { timer } from '$stores/timer';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import TimeRecordFormModal from './TimeRecordFormModal.svelte';
	import { Square } from 'lucide-svelte';

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
		enums: Record<string, EnumOption[]>;
		employees: PersonOption[];
		currentUserId: number | null;
	}

	let { enums, employees, currentUserId }: Props = $props();

	let elapsed = $state(0);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	// Modal state
	let modalOpen = $state(false);
	let stoppedTaskId = $state<number | null>(null);
	let stoppedMinutes = $state(0);

	$effect(() => {
		if ($timer.isRunning) {
			elapsed = timer.getElapsedSeconds();
			intervalId = setInterval(() => {
				elapsed = timer.getElapsedSeconds();
			}, 1000);
		} else {
			elapsed = 0;
			if (intervalId) {
				clearInterval(intervalId);
				intervalId = null;
			}
		}

		return () => {
			if (intervalId) {
				clearInterval(intervalId);
				intervalId = null;
			}
		};
	});

	function formatTime(totalSeconds: number): string {
		const h = Math.floor(totalSeconds / 3600);
		const m = Math.floor((totalSeconds % 3600) / 60);
		const s = totalSeconds % 60;
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	function handleStop() {
		const result = timer.stop();
		if (result) {
			stoppedTaskId = result.taskId;
			stoppedMinutes = result.elapsedMinutes;
			modalOpen = true;
		}
	}

	function handleSaved() {
		stoppedTaskId = null;
		stoppedMinutes = 0;
		invalidateAll();
	}

	function handleModalClose(open: boolean) {
		if (!open) {
			modalOpen = false;
			stoppedTaskId = null;
			stoppedMinutes = 0;
		}
	}
</script>

{#if $timer.isRunning}
	<div class="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1">
		<span class="relative flex h-2 w-2">
			<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
			<span class="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
		</span>
		<span class="max-w-[120px] truncate text-xs font-medium">{$timer.taskName}</span>
		<span class="font-mono text-md tabular-nums">{formatTime(elapsed)}</span>
		<Button
			variant="ghost"
			size="icon"
			class="h-6 w-6 text-destructive hover:bg-destructive/10"
			onclick={handleStop}
			title="Stop timer"
		>
			<Square class="h-3 w-3 fill-current" />
		</Button>
	</div>
{/if}

{#if stoppedTaskId}
	<TimeRecordFormModal
		open={modalOpen}
		onOpenChange={handleModalClose}
		taskId={stoppedTaskId}
		record={{
			date: new Date().toISOString().slice(0, 10),
			minutes: stoppedMinutes,
			description: null,
			type: null,
			category: null,
			billable: true,
			userId: currentUserId
		}}
		typeOptions={enums.time_record_type || []}
		categoryOptions={enums.time_record_category || []}
		{employees}
		defaultUserId={currentUserId}
		onSaved={handleSaved}
	/>
{/if}
