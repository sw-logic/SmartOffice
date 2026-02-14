<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { saveListState, restoreListState } from '$lib/utils/list-state';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import UserAvatar from '$lib/components/shared/UserAvatar.svelte';
	import { ListSearch, SortableHeader, ListPagination, DeleteConfirmDialog } from '$lib/components/shared/list';
	import {
		Plus,
		Pencil,
		Trash2,
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

	function updateStatus(value: string | undefined) {
		if (!value) return;
		const url = new URL($page.url);
		url.searchParams.set('status', value);
		url.searchParams.set('page', '1');
		goto(url.toString(), { replaceState: true });
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
		<ListSearch placeholder="Search projects..." />

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
					<SortableHeader column="priority" label="Priority" class="w-[90px]" />
					<SortableHeader column="name" label="Name" class="w-[250px]" />
					<SortableHeader column="client" label="Client" />
					<SortableHeader column="status" label="Status" class="w-[100px]" />
					<SortableHeader column="startDate" label="Start Date" />
					<SortableHeader column="endDate" label="End Date" />
					<Table.Head class="text-center">Info</Table.Head>
					<SortableHeader column="createdAt" label="Created" />
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
								{@const pEnum = data.enums.priority?.find((e) => e.value === project.priority)}
								<div class="flex items-center gap-1.5">
									{#if pEnum?.color}
										<span class="shrink-0 rounded-full" style="width:10px;height:10px;background-color:{pEnum.color}"></span>
									{/if}
									<span class="text-sm text-muted-foreground">{pEnum?.label ?? project.priority}</span>
								</div>
							</Table.Cell>
							<Table.Cell>
								<div class="flex flex-col">
									<span class="font-medium">
										{project.name}
									</span>
									{#if project.projectManager}
										<span class="text-sm text-muted-foreground flex items-center gap-1">
											<UserAvatar user={project.projectManager} size="xs" />
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

	<ListPagination pagination={data.pagination} noun="projects" />
</div>

<DeleteConfirmDialog
	bind:open={deleteDialogOpen}
	title="Delete Project"
	name={projectToDelete?.name}
	{isDeleting}
	onconfirm={handleDelete}
/>
