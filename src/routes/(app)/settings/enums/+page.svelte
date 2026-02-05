<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import { Search, Pencil, Shield, ChevronDown, ChevronRight } from 'lucide-svelte';

	let { data } = $props();

	let search = $state('');
	let expandedGroups = $state<Record<string, boolean>>({});

	// Sync search with URL params
	$effect(() => {
		search = data.filters.search;
	});

	// Group enums by their group field
	let groupedEnums = $derived(() => {
		const groups: Record<string, typeof data.enumTypes> = {};

		// Define group order
		const groupOrder = ['Generic', 'Finances', 'Clients', 'Vendors', 'Employees', 'Projects', 'Offers', 'Price Lists'];

		for (const enumType of data.enumTypes) {
			const group = enumType.group || 'Generic';
			if (!groups[group]) {
				groups[group] = [];
			}
			groups[group].push(enumType);
		}

		// Sort groups by predefined order
		const sortedGroups: Array<{ name: string; enums: typeof data.enumTypes }> = [];
		for (const groupName of groupOrder) {
			if (groups[groupName]) {
				sortedGroups.push({ name: groupName, enums: groups[groupName] });
				delete groups[groupName];
			}
		}
		// Add any remaining groups (shouldn't happen, but just in case)
		for (const [name, enums] of Object.entries(groups)) {
			sortedGroups.push({ name, enums });
		}

		return sortedGroups;
	});

	// Initialize all groups as collapsed
	$effect(() => {
		const groups = groupedEnums();
		for (const group of groups) {
			if (!(group.name in expandedGroups)) {
				expandedGroups[group.name] = false;
			}
		}
	});

	function updateSearch() {
		const url = new URL($page.url);
		if (search) {
			url.searchParams.set('search', search);
		} else {
			url.searchParams.delete('search');
		}
		goto(url.toString(), { replaceState: true });
	}

	function toggleGroup(groupName: string) {
		expandedGroups[groupName] = !expandedGroups[groupName];
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Enum Management</h1>
			<p class="text-muted-foreground">Manage dropdown values used throughout the system</p>
		</div>
	</div>

	<div class="flex items-center gap-4">
		<div class="relative flex-1 max-w-sm">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search enum types..."
				class="pl-10 pr-10"
				bind:value={search}
				onkeydown={(e) => e.key === 'Enter' && updateSearch()}
				oninput={(e) => {
					if (e.currentTarget.value === '' && data.filters.search) {
						updateSearch();
					}
				}}
			/>
			{#if search}
				<Button
					variant="ghost"
					size="icon"
					class="absolute right-0 top-1/2 -translate-y-1/2 h-full px-3 hover:bg-transparent"
					onclick={updateSearch}
				>
					<Search class="h-4 w-4" />
				</Button>
			{/if}
		</div>
	</div>

	{#if data.enumTypes.length === 0}
		<div class="rounded-md border p-8 text-center text-muted-foreground">
			No enum types found.
		</div>
	{:else}
		<div class="space-y-4">
			{#each groupedEnums() as group}
				<div class="rounded-md border">
					<button
						type="button"
						class="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
						onclick={() => toggleGroup(group.name)}
					>
						<div class="flex items-center gap-2">
							{#if expandedGroups[group.name]}
								<ChevronDown class="h-4 w-4" />
							{:else}
								<ChevronRight class="h-4 w-4" />
							{/if}
							<span class="font-semibold">{group.name}</span>
							<Badge variant="secondary">{group.enums.length}</Badge>
						</div>
					</button>

					{#if expandedGroups[group.name]}
						<div class="border-t">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head class="w-[250px]">Name</Table.Head>
										<Table.Head>Code</Table.Head>
										<Table.Head>Description</Table.Head>
										<Table.Head class="w-[100px] text-center">Values</Table.Head>
										<Table.Head class="w-[100px]">Type</Table.Head>
										<Table.Head class="w-[80px]">Actions</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each group.enums as enumType}
										<Table.Row
											class="cursor-pointer hover:bg-muted/50"
											onclick={() => goto(`/settings/enums/${enumType.code}`)}
										>
											<Table.Cell class="font-medium">{enumType.name}</Table.Cell>
											<Table.Cell>
												<code class="text-sm bg-muted px-1.5 py-0.5 rounded">{enumType.code}</code>
											</Table.Cell>
											<Table.Cell class="text-muted-foreground">
												{enumType.description || '-'}
											</Table.Cell>
											<Table.Cell class="text-center">
												<Badge variant="secondary">{enumType.valueCount}</Badge>
											</Table.Cell>
											<Table.Cell>
												{#if enumType.isSystem}
													<Badge variant="outline" class="gap-1">
														<Shield class="h-3 w-3" />
														System
													</Badge>
												{:else}
													<Badge variant="secondary">Custom</Badge>
												{/if}
											</Table.Cell>
											<Table.Cell>
												<Button variant="ghost" size="icon" href="/settings/enums/{enumType.code}">
													<Pencil class="h-4 w-4" />
												</Button>
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<div class="text-sm text-muted-foreground">
		<p>
			<strong>System enums</strong> are core to the application and cannot be deleted. You can add
			new values to them.
		</p>
		<p>
			<strong>Custom enums</strong> can be fully managed including adding, editing, and removing
			values.
		</p>
	</div>
</div>
