<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Popover from '$lib/components/ui/popover';
	import { Calendar, ChevronDown } from 'lucide-svelte';

	interface Props {
		startDate: string;
		endDate: string;
		onRangeChange: (start: string, end: string) => void;
	}

	let { startDate, endDate, onRangeChange }: Props = $props();

	let popoverOpen = $state(false);
	let customStartDate = $state(startDate);
	let customEndDate = $state(endDate);

	const shortcuts = [
		{ label: 'Current Month', getValue: () => getCurrentMonth() },
		{ label: 'Previous Month', getValue: () => getPreviousMonth() },
		{ label: 'This Quarter', getValue: () => getCurrentQuarter() },
		{ label: 'Previous Quarter', getValue: () => getPreviousQuarter() },
		{ label: 'This Year', getValue: () => getCurrentYear() },
		{ label: 'Last 30 Days', getValue: () => getLast30Days() },
		{ label: 'Last 90 Days', getValue: () => getLast90Days() }
	];

	function getCurrentMonth(): { start: string; end: string } {
		const now = new Date();
		const start = new Date(now.getFullYear(), now.getMonth(), 1);
		const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		return { start: formatDate(start), end: formatDate(end) };
	}

	function getPreviousMonth(): { start: string; end: string } {
		const now = new Date();
		const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const end = new Date(now.getFullYear(), now.getMonth(), 0);
		return { start: formatDate(start), end: formatDate(end) };
	}

	function getCurrentQuarter(): { start: string; end: string } {
		const now = new Date();
		const quarter = Math.floor(now.getMonth() / 3);
		const start = new Date(now.getFullYear(), quarter * 3, 1);
		const end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
		return { start: formatDate(start), end: formatDate(end) };
	}

	function getPreviousQuarter(): { start: string; end: string } {
		const now = new Date();
		const quarter = Math.floor(now.getMonth() / 3) - 1;
		const year = quarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
		const adjustedQuarter = quarter < 0 ? 3 : quarter;
		const start = new Date(year, adjustedQuarter * 3, 1);
		const end = new Date(year, adjustedQuarter * 3 + 3, 0);
		return { start: formatDate(start), end: formatDate(end) };
	}

	function getCurrentYear(): { start: string; end: string } {
		const now = new Date();
		const start = new Date(now.getFullYear(), 0, 1);
		const end = new Date(now.getFullYear(), 11, 31);
		return { start: formatDate(start), end: formatDate(end) };
	}

	function getLast30Days(): { start: string; end: string } {
		const now = new Date();
		const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
		return { start: formatDate(start), end: formatDate(now) };
	}

	function getLast90Days(): { start: string; end: string } {
		const now = new Date();
		const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
		return { start: formatDate(start), end: formatDate(now) };
	}

	function formatDate(date: Date): string {
		return date.toISOString().split('T')[0];
	}

	function formatDisplayDate(dateStr: string): string {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function applyShortcut(shortcut: (typeof shortcuts)[0]) {
		const { start, end } = shortcut.getValue();
		customStartDate = start;
		customEndDate = end;
		onRangeChange(start, end);
		popoverOpen = false;
	}

	function applyCustomRange() {
		if (customStartDate && customEndDate) {
			onRangeChange(customStartDate, customEndDate);
			popoverOpen = false;
		}
	}

	// Determine the current display label
	let displayLabel = $derived.by(() => {
		for (const shortcut of shortcuts) {
			const { start, end } = shortcut.getValue();
			if (start === startDate && end === endDate) {
				return shortcut.label;
			}
		}
		return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
	});
</script>

<Popover.Root bind:open={popoverOpen}>
	<Popover.Trigger>
		<Button variant="outline" class="min-w-[240px] justify-between">
			<span class="flex items-center gap-2">
				<Calendar class="h-4 w-4" />
				{displayLabel}
			</span>
			<ChevronDown class="h-4 w-4 opacity-50" />
		</Button>
	</Popover.Trigger>
	<Popover.Content class="w-auto p-0" align="start">
		<div class="flex">
			<!-- Shortcuts -->
			<div class="border-r p-2 space-y-1">
				{#each shortcuts as shortcut}
					<Button
						variant="ghost"
						size="sm"
						class="w-full justify-start"
						onclick={() => applyShortcut(shortcut)}
					>
						{shortcut.label}
					</Button>
				{/each}
			</div>

			<!-- Custom Range -->
			<div class="p-4 space-y-4">
				<div class="text-sm font-medium">Custom Range</div>
				<div class="space-y-2">
					<div class="space-y-1">
						<label class="text-xs text-muted-foreground">Start Date</label>
						<Input type="date" bind:value={customStartDate} class="w-40" />
					</div>
					<div class="space-y-1">
						<label class="text-xs text-muted-foreground">End Date</label>
						<Input type="date" bind:value={customEndDate} class="w-40" />
					</div>
				</div>
				<Button size="sm" onclick={applyCustomRange} class="w-full">Apply</Button>
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
