<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	let {
		pagination,
		noun = 'items'
	}: {
		pagination: { page: number; limit: number; total: number; totalPages: number };
		noun?: string;
	} = $props();

	let from = $derived((pagination.page - 1) * pagination.limit + 1);
	let to = $derived(Math.min(pagination.page * pagination.limit, pagination.total));

	function goToPage(newPage: number) {
		const url = new URL($page.url);
		url.searchParams.set('page', newPage.toString());
		goto(url.toString(), { replaceState: true });
	}
</script>

{#if pagination.totalPages > 1}
	<div class="flex items-center justify-between">
		<p class="text-sm text-muted-foreground">
			Showing {from} to {to} of {pagination.total} {noun}
		</p>
		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={pagination.page === 1}
				onclick={() => goToPage(pagination.page - 1)}
			>
				<ChevronLeft class="h-4 w-4" />
				Previous
			</Button>
			<span class="text-sm">
				Page {pagination.page} of {pagination.totalPages}
			</span>
			<Button
				variant="outline"
				size="sm"
				disabled={pagination.page === pagination.totalPages}
				onclick={() => goToPage(pagination.page + 1)}
			>
				Next
				<ChevronRight class="h-4 w-4" />
			</Button>
		</div>
	</div>
{/if}
