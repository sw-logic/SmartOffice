<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import { ChevronDown, ChevronRight } from 'lucide-svelte';

	interface Props {
		label: string;
		color?: string | null;
		count: number;
		subtotalAmount: number;
		subtotalTaxValue?: number;
		colspan: number;
		expanded: boolean;
		onToggle: () => void;
		formatCurrency: (amount: number) => string;
		colorClass?: string;
	}

	let {
		label,
		color = null,
		count,
		subtotalAmount,
		subtotalTaxValue,
		colspan,
		expanded,
		onToggle,
		formatCurrency,
		colorClass = ''
	}: Props = $props();
</script>

<Table.Row class="bg-muted/30 cursor-pointer hover:bg-muted/50" onclick={onToggle}>
	<Table.Cell {colspan}>
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2 font-medium">
				{#if expanded}
					<ChevronDown class="h-4 w-4" />
				{:else}
					<ChevronRight class="h-4 w-4" />
				{/if}
				{#if color}
					<span
						class="inline-block h-3 w-3 rounded-full"
						style="background-color: {color}"
					></span>
				{/if}
				{label}
				<span class="text-muted-foreground font-normal text-sm">({count})</span>
			</div>
			<div class="flex items-center gap-4 text-sm">
				{#if subtotalTaxValue !== undefined}
					<span class="text-muted-foreground">Tax: {formatCurrency(subtotalTaxValue)}</span>
				{/if}
				<span class="font-semibold {colorClass}">
					{formatCurrency(subtotalAmount)}
				</span>
			</div>
		</div>
	</Table.Cell>
</Table.Row>
