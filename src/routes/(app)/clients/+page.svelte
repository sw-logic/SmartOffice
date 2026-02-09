<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { saveListState, restoreListState } from '$lib/utils/list-state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import * as Table from '$lib/components/ui/table';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Select from '$lib/components/ui/select';
	import * as Avatar from '$lib/components/ui/avatar';
	import {
		Plus,
		Search,
		ArrowUpDown,
		ArrowUp,
		ArrowDown,
		Pencil,
		Trash2,
		ChevronLeft,
		ChevronRight,
		Eye,
		Building2,
		Users,
		Briefcase
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	// Persist/restore list view state
	const LIST_ROUTE = '/clients';
	let _stateRestored = false;
	$effect(() => {
		if (!browser) return;
		if (!_stateRestored) {
			_stateRestored = true;
			if (!$page.url.search) {
				const saved = restoreListState(LIST_ROUTE);
				if (saved) { goto(LIST_ROUTE + saved, { replaceState: true }); return; }
			}
		}
		saveListState(LIST_ROUTE, $page.url.search);
	});

	let search = $state(data.filters.search);
	let deleteDialogOpen = $state(false);
	let clientToDelete = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);

	const statusOptions = [
		{ value: 'active', label: 'Active clients' },
		{ value: 'inactive', label: 'Inactive clients' },
		{ value: 'archived', label: 'Archived clients' }
	];

	function updateSearch() {
		const url = new URL($page.url);
		if (search) {
			url.searchParams.set('search', search);
		} else {
			url.searchParams.delete('search');
		}
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true });
	}

	function updateStatus(value: string | undefined) {
		if (!value) return;
		const url = new URL($page.url);
		url.searchParams.set('status', value);
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true });
	}

	function updateSort(column: string) {
		const url = new URL($page.url);
		const currentSort = url.searchParams.get('sortBy');
		const currentOrder = url.searchParams.get('sortOrder') || 'asc';

		if (currentSort === column) {
			url.searchParams.set('sortOrder', currentOrder === 'asc' ? 'desc' : 'asc');
		} else {
			url.searchParams.set('sortBy', column);
			url.searchParams.set('sortOrder', 'asc');
		}
		goto(url.toString(), { replaceState: true });
	}

	function goToPage(newPage: number) {
		const url = new URL($page.url);
		url.searchParams.set('page', newPage.toString());
		goto(url.toString(), { replaceState: true });
	}

	function getSortIcon(column: string) {
		if (data.filters.sortBy !== column) return ArrowUpDown;
		return data.filters.sortOrder === 'asc' ? ArrowUp : ArrowDown;
	}

	function confirmDelete(client: { id: number; name: string }) {
		clientToDelete = client;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!clientToDelete) return;

		isDeleting = true;
		const formData = new FormData();
		formData.append('id', String(clientToDelete.id));

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Client deleted successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete client');
		}

		isDeleting = false;
		deleteDialogOpen = false;
		clientToDelete = null;
	}

</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Clients</h1>
			<p class="text-muted-foreground">Manage your company's clients and their information</p>
		</div>
		<Button href="/clients/new">
			<Plus class="mr-2 h-4 w-4" />
			Add Client
		</Button>
	</div>

	<div class="flex items-center gap-4">
		<div class="relative flex-1 max-w-sm">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search clients..."
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

		<Select.Root
			type="single"
			value={data.filters.status}
			onValueChange={updateStatus}
		>
			<Select.Trigger class="w-[180px]">
				{statusOptions.find(o => o.value === data.filters.status)?.label || 'All clients'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="all">All clients</Select.Item>
				{#each statusOptions as option}
					<Select.Item value={option.value}>{option.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[250px]">
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('name')}>
							Client
							<svelte:component this={getSortIcon('name')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('email')}>
							Email
							<svelte:component this={getSortIcon('email')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('city')}>
							Location
							<svelte:component this={getSortIcon('city')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>Industry</Table.Head>
					<Table.Head class="w-[100px]">Status</Table.Head>
					<Table.Head class="text-center">Projects</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('createdAt')}>
							Created
							<svelte:component this={getSortIcon('createdAt')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head class="w-[140px]">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.clients.length === 0}
					<Table.Row>
						<Table.Cell colspan={8} class="h-24 text-center">
							No clients found.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.clients as client}
						<Table.Row
							class="cursor-pointer hover:bg-muted/50"
							onclick={() => goto(`/clients/${client.id}`)}
						>
							<Table.Cell>
								<div class="flex items-center gap-3">
									<Avatar.Root>
										<Avatar.Fallback class="text-xs">{client.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}</Avatar.Fallback>
									</Avatar.Root>
									<div class="flex flex-col">
										<span class="font-medium">
											{client.name}
										</span>
										{#if client.companyName}
											<span class="text-sm text-muted-foreground flex items-center gap-1">
												<Building2 class="h-3 w-3" />
												{client.companyName}
											</span>
										{/if}
									</div>
								</div>
							</Table.Cell>
							<Table.Cell>
								{#if client.email}
									<a href="mailto:{client.email}" class="text-primary hover:underline">
										{client.email}
									</a>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if client.city || client.country}
									{[client.city, client.country].filter(Boolean).join(', ')}
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if client.industry}
									<Badge variant="outline">{client.industry}</Badge>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								<EnumBadge enums={data.enums.entity_status} value={client.status} />
							</Table.Cell>
							<Table.Cell class="text-center">
								<div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
									<span class="flex items-center gap-1" title="Projects">
										<Briefcase class="h-3 w-3" />
										{client.projectCount}
									</span>
									<span class="flex items-center gap-1" title="Contacts">
										<Users class="h-3 w-3" />
										{client.contactCount}
									</span>
								</div>
							</Table.Cell>
							<Table.Cell>
								{formatDate(client.createdAt)}
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
									<Button variant="ghost" size="icon" href="/clients/{client.id}" title="View client">
										<Eye class="h-4 w-4" />
									</Button>
									<Button variant="ghost" size="icon" href="/clients/{client.id}/edit" title="Edit client">
										<Pencil class="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onclick={() => confirmDelete({ id: client.id, name: client.name })}
										title="Delete client"
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	{#if data.pagination.totalPages > 1}
		<div class="flex items-center justify-between">
			<p class="text-sm text-muted-foreground">
				Showing {(data.pagination.page - 1) * data.pagination.limit + 1} to {Math.min(
					data.pagination.page * data.pagination.limit,
					data.pagination.total
				)} of {data.pagination.total} clients
			</p>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={data.pagination.page === 1}
					onclick={() => goToPage(data.pagination.page - 1)}
				>
					<ChevronLeft class="h-4 w-4" />
					Previous
				</Button>
				<span class="text-sm">
					Page {data.pagination.page} of {data.pagination.totalPages}
				</span>
				<Button
					variant="outline"
					size="sm"
					disabled={data.pagination.page === data.pagination.totalPages}
					onclick={() => goToPage(data.pagination.page + 1)}
				>
					Next
					<ChevronRight class="h-4 w-4" />
				</Button>
			</div>
		</div>
	{/if}
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Client</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{clientToDelete?.name}</strong>? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				onclick={handleDelete}
				disabled={isDeleting}
			>
				{isDeleting ? 'Deleting...' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
