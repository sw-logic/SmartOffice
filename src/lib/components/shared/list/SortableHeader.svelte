<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-svelte';

	let {
		column,
		label,
		defaultOrder = 'asc',
		class: className
	}: {
		column: string;
		label: string;
		defaultOrder?: 'asc' | 'desc';
		class?: string;
	} = $props();

	let sortBy = $derived($page.url.searchParams.get('sortBy') || 'createdAt');
	let sortOrder = $derived($page.url.searchParams.get('sortOrder') || defaultOrder);
	let isActive = $derived(sortBy === column);

	let Icon = $derived(
		!isActive ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown
	);

	function toggleSort() {
		const url = new URL($page.url);
		if (isActive) {
			url.searchParams.set('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc');
		} else {
			url.searchParams.set('sortBy', column);
			url.searchParams.set('sortOrder', defaultOrder);
		}
		goto(url.toString(), { replaceState: true });
	}
</script>

<Table.Head class={className}>
	<Button variant="ghost" class="-ml-4" onclick={toggleSort}>
		{label}
		<Icon class="ml-2 h-4 w-4" />
	</Button>
</Table.Head>
