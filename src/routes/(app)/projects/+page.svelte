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
		Users,
		ListChecks
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	// Persist/restore list view state
	const LIST_ROUTE = '/projects';
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
	let projectToDelete = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);

	const statusOptions = [
		{ value: 'active', label: 'Active projects' },
		{ value: 'planning', label: 'Planning' },
		{ value: 'on_hold', label: 'On Hold' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' },
		{ value: 'archived', label: 'Archived' },
		{ value: 'all', label: 'All projects' }
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

	function confirmDelete(project: { id: number; name: string }) {
		projectToDelete = project;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!projectToDelete) return;

		isDeleting = true;
		const formData = new FormData();
		formData.append('id', String(projectToDelete.id));

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Project deleted successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete project');
		}

		isDeleting = false;
		deleteDialogOpen = false;
		projectToDelete = null;
	}

</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Projects</h1>
			<p class="text-muted-foreground">Manage your company's projects</p>
		</div>
		{#if data.canCreate}
			<Button href="/projects/new">
				<Plus class="mr-2 h-4 w-4" />
				New Project
			</Button>
		{/if}
	</div>

	<div class="flex items-center gap-4">
		<div class="relative flex-1 max-w-sm">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search projects..."
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
				{statusOptions.find(o => o.value === data.filters.status)?.label || 'Active projects'}
			</Select.Trigger>
			<Select.Content>
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
							Name
							<svelte:component this={getSortIcon('name')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('client')}>
							Client
							<svelte:component this={getSortIcon('client')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head class="w-[100px]">
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('status')}>
							Status
							<svelte:component this={getSortIcon('status')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head class="w-[90px]">
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('priority')}>
							Priority
							<svelte:component this={getSortIcon('priority')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('startDate')}>
							Start Date
							<svelte:component this={getSortIcon('startDate')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('endDate')}>
							End Date
							<svelte:component this={getSortIcon('endDate')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head class="text-center">Info</Table.Head>
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
				{#if data.projects.length === 0}
					<Table.Row>
						<Table.Cell colspan={9} class="h-24 text-center">
							No projects found.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.projects as project}
						<Table.Row
							class="cursor-pointer hover:bg-muted/50"
							onclick={() => goto(`/projects/${project.id}`)}
						>
							<Table.Cell>
								<div class="flex flex-col">
									<span class="font-medium">
										{project.name}
									</span>
									{#if project.projectManager}
										<span class="text-sm text-muted-foreground flex items-center gap-1">
											<Avatar.Root class="size-5">
												<Avatar.Fallback class="text-[9px]">{(project.projectManager.firstName ?? '')[0]}{(project.projectManager.lastName ?? '')[0]}</Avatar.Fallback>
											</Avatar.Root>
											PM: {project.projectManager.firstName ?? ''} {project.projectManager.lastName ?? ''}
										</span>
									{/if}
								</div>
							</Table.Cell>
							<Table.Cell>
								{project.client.name}
							</Table.Cell>
							<Table.Cell>
								<EnumBadge enums={data.enums.project_status} value={project.status} />
							</Table.Cell>
							<Table.Cell>
								<EnumBadge enums={data.enums.priority} value={project.priority} />
							</Table.Cell>
							<Table.Cell>
								{#if project.startDate}
									{formatDate(project.startDate)}
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if project.endDate}
									{formatDate(project.endDate)}
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-center">
								<div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
									<span class="flex items-center gap-1" title="Tasks">
										<ListChecks class="h-3 w-3" />
										{project.taskCount}
									</span>
									<span class="flex items-center gap-1" title="Team members">
										<Users class="h-3 w-3" />
										{project.teamCount}
									</span>
								</div>
							</Table.Cell>
							<Table.Cell>
								{formatDate(project.createdAt)}
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
									<Button variant="ghost" size="icon" href="/projects/{project.id}" title="View project">
										<Eye class="h-4 w-4" />
									</Button>
									<Button variant="ghost" size="icon" href="/projects/{project.id}/edit" title="Edit project">
										<Pencil class="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onclick={() => confirmDelete({ id: project.id, name: project.name })}
										title="Delete project"
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
				)} of {data.pagination.total} projects
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
			<AlertDialog.Title>Delete Project</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{projectToDelete?.name}</strong>? This action cannot be undone.
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
