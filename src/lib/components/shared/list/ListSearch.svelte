<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Search } from 'lucide-svelte';

	let { placeholder = 'Search...' }: { placeholder?: string } = $props();

	let search = $state($page.url.searchParams.get('search') || '');

	// Sync when URL changes externally (e.g. browser back/forward)
	$effect(() => {
		search = $page.url.searchParams.get('search') || '';
	});

	function doSearch() {
		const url = new URL($page.url);
		if (search) {
			url.searchParams.set('search', search);
		} else {
			url.searchParams.delete('search');
		}
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true });
	}
</script>

<div class="relative flex-1 max-w-sm">
	<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
	<Input
		type="search"
		{placeholder}
		class="pl-10 pr-10"
		bind:value={search}
		onkeydown={(e) => e.key === 'Enter' && doSearch()}
		oninput={(e) => {
			if (e.currentTarget.value === '' && $page.url.searchParams.get('search')) {
				doSearch();
			}
		}}
	/>
	{#if search}
		<Button
			variant="ghost"
			size="icon"
			class="absolute right-0 top-1/2 -translate-y-1/2 h-full px-3 hover:bg-transparent"
			onclick={doSearch}
		>
			<Search class="h-4 w-4" />
		</Button>
	{/if}
</div>
