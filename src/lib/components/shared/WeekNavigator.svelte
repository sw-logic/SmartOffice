<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameWeek } from 'date-fns';

	interface Props {
		weekStart: string; // ISO date string of Monday
		viewMode: 'workweek' | 'fullweek';
		onWeekChange: (newWeekStart: string) => void;
		onViewModeChange: (mode: 'workweek' | 'fullweek') => void;
	}

	let { weekStart, viewMode, onWeekChange, onViewModeChange }: Props = $props();

	let monday = $derived(startOfWeek(new Date(weekStart + 'T00:00:00'), { weekStartsOn: 1 }));

	let endDay = $derived(viewMode === 'workweek' ? addDays(monday, 4) : addDays(monday, 6));

	let label = $derived(() => {
		const startMonth = format(monday, 'MMM');
		const endMonth = format(endDay, 'MMM');
		const startDay = format(monday, 'd');
		const endDayStr = format(endDay, 'd');
		const year = format(endDay, 'yyyy');
		if (startMonth === endMonth) {
			return `${startMonth} ${startDay} – ${endDayStr}, ${year}`;
		}
		return `${startMonth} ${startDay} – ${endMonth} ${endDayStr}, ${year}`;
	});

	let isCurrentWeek = $derived(isSameWeek(monday, new Date(), { weekStartsOn: 1 }));

	function goPrev() {
		const prev = subWeeks(monday, 1);
		onWeekChange(format(prev, 'yyyy-MM-dd'));
	}

	function goNext() {
		const next = addWeeks(monday, 1);
		onWeekChange(format(next, 'yyyy-MM-dd'));
	}

	function goToday() {
		const today = startOfWeek(new Date(), { weekStartsOn: 1 });
		onWeekChange(format(today, 'yyyy-MM-dd'));
	}
</script>

<div class="flex items-center gap-2">
	<Button variant="outline" size="icon" class="h-8 w-8" onclick={goPrev}>
		<ChevronLeft class="h-4 w-4" />
	</Button>
	<span class="text-sm font-medium min-w-[180px] text-center">{label()}</span>
	<Button variant="outline" size="icon" class="h-8 w-8" onclick={goNext}>
		<ChevronRight class="h-4 w-4" />
	</Button>
	<Button variant="outline" size="sm" class="h-8" disabled={isCurrentWeek} onclick={goToday}>
		Today
	</Button>
	<div class="flex border rounded-md overflow-hidden ml-2">
		<button
			class="px-2.5 py-1 text-xs font-medium transition-colors {viewMode === 'workweek' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
			onclick={() => onViewModeChange('workweek')}
		>
			5d
		</button>
		<button
			class="px-2.5 py-1 text-xs font-medium transition-colors border-l {viewMode === 'fullweek' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
			onclick={() => onViewModeChange('fullweek')}
		>
			7d
		</button>
	</div>
</div>
