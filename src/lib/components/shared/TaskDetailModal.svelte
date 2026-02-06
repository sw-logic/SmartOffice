<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import TaskTagsEditor from './TaskTagsEditor.svelte';
	import NotesList from './NotesList.svelte';
	import TaskTimeRecordsList from './TaskTimeRecordsList.svelte';
	import { toast } from 'svelte-sonner';
	import {
		Loader2,
		Check,
		ChevronsUpDown,
		Pencil,
		X
	} from 'lucide-svelte';

	interface EnumOption {
		value: string;
		label: string;
	}

	interface PersonOption {
		id: number;
		firstName: string;
		lastName: string;
	}

	interface ProjectOption {
		id: number;
		name: string;
		client: { id: number; name: string };
		kanbanBoards: Array<{
			id: number;
			name: string;
			columns: Array<{ id: number; name: string }>;
			swimlanes: Array<{ id: number; name: string }>;
		}>;
	}

	interface AvailableTag {
		id: number;
		value: string;
		label: string;
		color: string | null;
	}

	interface TaskDefaults {
		projectId?: number;
		kanbanBoardId?: number;
		columnId?: number;
		swimlaneId?: number;
		status?: string;
		priority?: string;
		type?: string;
		category?: string;
		assignedToId?: number;
	}

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		taskId: number | null;
		projects: ProjectOption[];
		employees: PersonOption[];
		taskTypes: EnumOption[];
		taskCategories: EnumOption[];
		taskStatuses: EnumOption[];
		taskPriorities: EnumOption[];
		availableTags: AvailableTag[];
		timeRecordTypes: EnumOption[];
		timeRecordCategories: EnumOption[];
		defaults?: TaskDefaults;
		onTaskCreated?: () => void;
		onTaskUpdated?: () => void;
	}

	let {
		open = $bindable(),
		onOpenChange,
		taskId,
		projects,
		employees,
		taskTypes,
		taskCategories,
		taskStatuses,
		taskPriorities,
		availableTags,
		timeRecordTypes,
		timeRecordCategories,
		defaults,
		onTaskCreated,
		onTaskUpdated
	}: Props = $props();

	// Task state
	let loading = $state(false);
	let task = $state<Record<string, any> | null>(null);
	let tags = $state<any[]>([]);
	let isCreating = $state(false);

	// View/edit toggle for existing tasks
	let isEditing = $state(false);

	// Unified form data for create mode
	let formData = $state({
		name: '',
		description: '',
		projectId: null as number | null,
		kanbanBoardId: null as number | null,
		columnId: null as number | null,
		swimlaneId: null as number | null,
		status: '',
		type: null as string | null,
		category: null as string | null,
		priority: '',
		assignedToId: null as number | null,
		dueDate: '',
		estimatedTime: null as number | null,
		reviewerIds: [] as number[],
		followerIds: [] as number[]
	});

	// Editing states for view mode
	let nameValue = $state('');
	let descValue = $state('');
	let descChanged = $state(false);

	// Client filter (UI-only, not stored on task)
	let filterClientId = $state<number | null>(null);

	// Multi-select popovers
	let reviewerPopoverOpen = $state(false);
	let followerPopoverOpen = $state(false);
	let reviewerSearch = $state('');
	let followerSearch = $state('');

	// Derive unique clients from projects
	let clientOptions = $derived(
		[...new Map(projects.map(p => [p.client.id, p.client])).values()]
			.sort((a, b) => a.name.localeCompare(b.name))
	);

	// Active client ID
	let activeClientId = $derived(
		isCreating
			? filterClientId
			: (task?.project?.client?.id ?? filterClientId)
	);

	// Filtered projects based on selected client
	let filteredProjects = $derived(
		activeClientId
			? projects.filter(p => p.client.id === activeClientId)
			: projects
	);

	// Derived: active IDs based on mode
	let activeProjectId = $derived(isCreating ? formData.projectId : task?.projectId);
	let activeBoardId = $derived(isCreating ? formData.kanbanBoardId : task?.kanbanBoardId);

	let selectedProject = $derived(
		activeProjectId
			? projects.find(p => p.id === activeProjectId) || task?.project
			: null
	);

	let boardOptions = $derived(
		selectedProject?.kanbanBoards || []
	);

	let selectedBoard = $derived(
		activeBoardId
			? boardOptions.find((b: any) => b.id === activeBoardId)
			: null
	);

	let columnOptions = $derived(selectedBoard?.columns || []);
	let swimlaneOptions = $derived(selectedBoard?.swimlanes || []);

	let filteredReviewerEmployees = $derived(
		employees.filter(emp => {
			if (!reviewerSearch) return true;
			const q = reviewerSearch.toLowerCase();
			return `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q);
		})
	);

	let filteredFollowerEmployees = $derived(
		employees.filter(emp => {
			if (!followerSearch) return true;
			const q = followerSearch.toLowerCase();
			return `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q);
		})
	);

	let reviewerIds = $derived(
		isCreating
			? new Set<number>(formData.reviewerIds)
			: task?.reviewerIds ? new Set<number>(task.reviewerIds) : new Set<number>()
	);

	let followerIds = $derived(
		isCreating
			? new Set<number>(formData.followerIds)
			: task?.followerIds ? new Set<number>(task.followerIds) : new Set<number>()
	);

	// Create mode validation
	let canCreate = $derived(
		formData.name.trim() !== '' &&
		formData.projectId !== null &&
		formData.dueDate !== '' &&
		formData.estimatedTime !== null &&
		formData.estimatedTime > 0
	);

	// Load task data when opened
	$effect(() => {
		if (open && taskId) {
			loadTask(taskId);
		} else if (open && !taskId) {
			// New task mode
			task = null;
			tags = [];
			isCreating = true;
			isEditing = false;
			// Derive client from default project if provided
			const defaultProject = defaults?.projectId ? projects.find(p => p.id === defaults.projectId) : null;
			filterClientId = defaultProject?.client?.id ?? null;
			formData = {
				name: '',
				description: '',
				projectId: defaults?.projectId ?? null,
				kanbanBoardId: defaults?.kanbanBoardId ?? null,
				columnId: defaults?.columnId ?? null,
				swimlaneId: defaults?.swimlaneId ?? null,
				status: defaults?.status || taskStatuses[0]?.value || 'todo',
				type: defaults?.type ?? null,
				category: defaults?.category ?? null,
				priority: defaults?.priority || taskPriorities[0]?.value || 'medium',
				assignedToId: defaults?.assignedToId ?? null,
				dueDate: '',
				estimatedTime: null,
				reviewerIds: [],
				followerIds: []
			};
		}
	});

	async function loadTask(id: number) {
		loading = true;
		isCreating = false;
		isEditing = false;
		try {
			const res = await fetch(`/api/tasks/${id}`);
			if (res.ok) {
				const data = await res.json();
				task = data.task;
				tags = data.tags;
				nameValue = task!.name;
				descValue = task!.description || '';
				descChanged = false;
				filterClientId = task!.project?.client?.id ?? null;
			} else {
				toast.error('Failed to load task');
				onOpenChange(false);
			}
		} catch {
			toast.error('Failed to load task');
			onOpenChange(false);
		} finally {
			loading = false;
		}
	}

	async function createTask() {
		if (!canCreate) {
			toast.error('Name, project, due date, and estimated time are required');
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: formData.name.trim(),
					projectId: formData.projectId,
					description: formData.description.trim() || null,
					kanbanBoardId: formData.kanbanBoardId,
					columnId: formData.columnId,
					swimlaneId: formData.swimlaneId,
					status: formData.status,
					type: formData.type,
					category: formData.category,
					priority: formData.priority,
					assignedToId: formData.assignedToId,
					dueDate: formData.dueDate,
					estimatedTime: formData.estimatedTime,
					reviewerIds: formData.reviewerIds,
					followerIds: formData.followerIds
				})
			});

			if (res.ok) {
				const data = await res.json();
				toast.success('Task created');
				isCreating = false;
				// Load the full task
				await loadTask(data.task.id);
				onTaskCreated?.();
			} else {
				const data = await res.json();
				toast.error(data.error || 'Failed to create task');
			}
		} catch {
			toast.error('Failed to create task');
		} finally {
			loading = false;
		}
	}

	async function saveField(field: string, value: unknown) {
		if (!task?.id) return;

		try {
			const res = await fetch(`/api/tasks/${task.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ [field]: value })
			});

			if (res.ok) {
				const data = await res.json();
				// Update local task state
				task = { ...task, ...data.task };
				// If board changed, reload full task to get updated columns/swimlanes
				if (field === 'kanbanBoardId') {
					await loadTask(task!.id);
				}
				onTaskUpdated?.();
			} else {
				const data = await res.json();
				toast.error(data.error || 'Failed to update');
			}
		} catch {
			toast.error('Failed to update');
		}
	}

	function handleNameBlur() {
		if (task && nameValue.trim() && nameValue.trim() !== task.name) {
			saveField('name', nameValue.trim());
		}
	}

	function handleDescBlur() {
		if (task && descChanged) {
			saveField('description', descValue.trim() || null);
			descChanged = false;
		}
	}

	async function toggleReviewer(personId: number) {
		if (isCreating) {
			const newIds = new Set(formData.reviewerIds);
			if (newIds.has(personId)) { newIds.delete(personId); } else { newIds.add(personId); }
			formData.reviewerIds = [...newIds];
			return;
		}
		if (!task) return;
		const newIds = new Set(reviewerIds);
		if (newIds.has(personId)) {
			newIds.delete(personId);
		} else {
			newIds.add(personId);
		}
		const arr = [...newIds];
		task = { ...task, reviewerIds: arr };
		await saveField('reviewerIds', arr);
	}

	async function toggleFollower(personId: number) {
		if (isCreating) {
			const newIds = new Set(formData.followerIds);
			if (newIds.has(personId)) { newIds.delete(personId); } else { newIds.add(personId); }
			formData.followerIds = [...newIds];
			return;
		}
		if (!task) return;
		const newIds = new Set(followerIds);
		if (newIds.has(personId)) {
			newIds.delete(personId);
		} else {
			newIds.add(personId);
		}
		const arr = [...newIds];
		task = { ...task, followerIds: arr };
		await saveField('followerIds', arr);
	}

	function getInitials(firstName: string, lastName: string): string {
		return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
	}

	function formatDateTime(date: string | Date): string {
		return new Date(date).toLocaleString();
	}

	function handleOpenChange(newOpen: boolean) {
		if (!loading) {
			onOpenChange(newOpen);
		}
	}

	// Helper: get display values for right panel selects
	function getProjectDisplay(): string {
		if (isCreating) {
			return formData.projectId ? projects.find(p => p.id === formData.projectId)?.name || 'Select project' : 'Select project';
		}
		return task?.project?.name || 'Select project';
	}

	function getBoardDisplay(): string {
		if (isCreating) {
			if (!formData.kanbanBoardId) return 'None';
			return boardOptions.find((b: any) => b.id === formData.kanbanBoardId)?.name || 'None';
		}
		return task?.kanbanBoard?.name || selectedBoard?.name || 'None';
	}

	function getColumnDisplay(): string {
		if (isCreating) {
			if (!formData.columnId) return 'None';
			return columnOptions.find((c: any) => c.id === formData.columnId)?.name || 'None';
		}
		return task?.column?.name || columnOptions.find((c: any) => c.id === task?.columnId)?.name || 'None';
	}

	function getSwimlaneDisplay(): string {
		if (isCreating) {
			if (!formData.swimlaneId) return 'None';
			return swimlaneOptions.find((s: any) => s.id === formData.swimlaneId)?.name || 'None';
		}
		return task?.swimlane?.name || swimlaneOptions.find((s: any) => s.id === task?.swimlaneId)?.name || 'None';
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="w-[70vw] min-w-[1000px] h-[90vh] p-0 max-w-none max-h-none overflow-hidden flex flex-col">
		{#if loading && !task && !isCreating}
			<div class="flex items-center justify-center py-20">
				<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		{:else if isCreating || task}
			<!-- Unified two-panel layout for both create and view/edit -->
			<div class="flex-1 overflow-hidden flex flex-col">
				<div class="flex flex-1 overflow-hidden">
					<!-- LEFT COLUMN -->
					<div class="flex-1 min-w-0 overflow-y-auto p-4 space-y-2 flex flex-col">
						{#if isCreating}
							<!-- CREATE MODE: Name input + Description textarea -->
							<div>
								<Input
									placeholder="Task name *"
									bind:value={formData.name}
									class="text-xl font-bold border-none shadow-none px-2 py-1 -mx-2 focus-visible:ring-1"
									onkeydown={(e) => e.key === 'Enter' && e.preventDefault()}
								/>
							</div>
							<div class="space-y-1 flex-1">
								<Label class="text-xs text-muted-foreground">Description</Label>
								<Textarea
									placeholder="Add a description..."
									bind:value={formData.description}
									rows={6}
									class="resize-none"
								/>
							</div>
							<!-- Footer -->
							<div class="flex justify-end gap-2 pt-3 border-t mt-auto">
								<Button variant="outline" onclick={() => handleOpenChange(false)}>Cancel</Button>
								<Button onclick={createTask} disabled={!canCreate || loading}>
									{loading ? 'Creating...' : 'Create Task'}
								</Button>
							</div>
						{:else if task}
							<!-- VIEW / EDIT MODE -->
							<div class="flex items-start gap-2">
								<div class="flex-1 min-w-0">
									{#if isEditing}
										<Input
											bind:value={nameValue}
											class="text-xl font-bold"
											onblur={handleNameBlur}
											onkeydown={(e) => {
												if (e.key === 'Enter') handleNameBlur();
												if (e.key === 'Escape') { nameValue = task!.name; isEditing = false; }
											}}
											autofocus
										/>
									{:else}
										<h2 class="text-xl font-bold px-2 py-1 -mx-2">
											{task.name}
										</h2>
									{/if}
								</div>
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 shrink-0 mt-0.5"
									onclick={() => {
										if (isEditing) {
											// Save pending changes before exiting edit mode
											handleNameBlur();
											handleDescBlur();
											isEditing = false;
										} else {
											nameValue = task!.name;
											descValue = task!.description || '';
											descChanged = false;
											isEditing = true;
										}
									}}
									title={isEditing ? 'Stop editing' : 'Edit'}
								>
									{#if isEditing}
										<X class="h-4 w-4" />
									{:else}
										<Pencil class="h-4 w-4" />
									{/if}
								</Button>
							</div>

							<!-- Created info -->
							<div class="flex flex-row gap-3 text-xs text-muted-foreground">
								<p>Created {formatDateTime(task.createdAt)}</p>
								<p>by {task.createdBy?.name || 'Unknown'}</p>
								{#if task.updatedAt && task.updatedAt !== task.createdAt}
									<p>Updated {formatDateTime(task.updatedAt)}</p>
								{/if}
							</div>

							<!-- Tags -->
							<TaskTagsEditor
								taskId={task.id}
								{tags}
								{availableTags}
								onTagsChange={(newTags) => tags = newTags}
							/>

							<!-- Description -->
							<div class="space-y-1">
								<Label class="text-xs text-muted-foreground">Description</Label>
								{#if isEditing}
									<Textarea
										placeholder="Add a description..."
										bind:value={descValue}
										oninput={() => descChanged = true}
										onblur={handleDescBlur}
										rows={4}
										class="resize-none"
									/>
								{:else}
									<p class="text-sm whitespace-pre-wrap px-2 py-1 min-h-[60px] rounded bg-muted/30">
										{task.description || 'No description'}
									</p>
								{/if}
							</div>

							<!-- Notes & Time Records Tabs -->
							<Tabs.Root value="notes" class="w-full">
								<Tabs.List>
									<Tabs.Trigger value="notes">Notes</Tabs.Trigger>
									<Tabs.Trigger value="timeRecords">Time Records ({task.timeRecords?.length || 0})</Tabs.Trigger>
								</Tabs.List>
								<Tabs.Content value="notes" class="mt-3">
									<NotesList entityType="Task" entityId={String(task.id)} />
								</Tabs.Content>
								<Tabs.Content value="timeRecords" class="mt-3">
									<TaskTimeRecordsList
										taskId={task.id}
										timeRecords={task.timeRecords || []}
										typeOptions={timeRecordTypes}
										categoryOptions={timeRecordCategories}
										onTimeRecordsChange={(records) => {
											task = { ...task, timeRecords: records };
											onTaskUpdated?.();
										}}
									/>
								</Tabs.Content>
							</Tabs.Root>
						{/if}
					</div>

					<!-- RIGHT COLUMN - identical for create and view/edit -->
					<div class="shrink-0 overflow-y-auto border-l p-4 pt-6 space-y-2 w-fit max-w-[320px]">
						<!-- Client (UI filter only) -->
						<div class="flex items-center gap-2">
							<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Client</Label>
							<Select.Root
								type="single"
								value={activeClientId ? String(activeClientId) : 'all'}
								onValueChange={(v) => {
									const newClientId = v === 'all' ? null : parseInt(v);
									filterClientId = newClientId;
									if (isCreating) {
										// Clear project + cascade if it doesn't belong to new client
										if (formData.projectId && newClientId) {
											const proj = projects.find(p => p.id === formData.projectId);
											if (proj && proj.client.id !== newClientId) {
												formData.projectId = null;
												formData.kanbanBoardId = null;
												formData.columnId = null;
												formData.swimlaneId = null;
											}
										} else if (!newClientId) {
											// "All" selected — keep current project
										}
									}
								}}
							>
								<Select.Trigger size="sm" class="h-8 text-sm flex-1">
									{activeClientId ? clientOptions.find(c => c.id === activeClientId)?.name || 'All clients' : 'All clients'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="all">All clients</Select.Item>
									{#each clientOptions as client}
										<Select.Item value={String(client.id)}>{client.name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>

						<!-- Project -->
						<div class="flex items-center gap-2">
							<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Project {isCreating ? '*' : ''}</Label>
							<Select.Root
								type="single"
								value={isCreating ? (formData.projectId ? String(formData.projectId) : undefined) : String(task?.projectId)}
								onValueChange={(v) => {
									if (!v) return;
									const id = parseInt(v);
									// Auto-set client from the selected project
									const proj = projects.find(p => p.id === id);
									if (proj) {
										filterClientId = proj.client.id;
									}
									if (isCreating) {
										formData.projectId = id;
										// Reset board/column/swimlane when project changes
										formData.kanbanBoardId = null;
										formData.columnId = null;
										formData.swimlaneId = null;
									} else {
										saveField('projectId', id);
									}
								}}
							>
								<Select.Trigger size="sm" class="h-8 text-sm flex-1">
									{getProjectDisplay()}
								</Select.Trigger>
								<Select.Content>
									{#each filteredProjects as project}
										<Select.Item value={String(project.id)}>
											{project.name}
											{#if !activeClientId}
												<span class="text-muted-foreground ml-1">({project.client.name})</span>
											{/if}
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>

						<!-- Board -->
						<div class="flex items-center gap-2">
							<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Board</Label>
							<Select.Root
								type="single"
								value={isCreating ? (formData.kanbanBoardId ? String(formData.kanbanBoardId) : 'none') : (task?.kanbanBoardId ? String(task.kanbanBoardId) : 'none')}
								onValueChange={(v) => {
									const val = v === 'none' ? null : parseInt(v);
									if (isCreating) {
										formData.kanbanBoardId = val;
										formData.columnId = null;
										formData.swimlaneId = null;
									} else {
										saveField('kanbanBoardId', val);
									}
								}}
							>
								<Select.Trigger size="sm" class="h-8 text-sm flex-1">
									{getBoardDisplay()}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="none">None</Select.Item>
									{#each boardOptions as board}
										<Select.Item value={String(board.id)}>{board.name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>

						<!-- Column (Stage) -->
						{#if columnOptions.length > 0}
							<div class="flex items-center gap-2">
								<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Column</Label>
								<Select.Root
									type="single"
									value={isCreating ? (formData.columnId ? String(formData.columnId) : 'none') : (task?.columnId ? String(task.columnId) : 'none')}
									onValueChange={(v) => {
										const val = v === 'none' ? null : parseInt(v);
										if (isCreating) {
											formData.columnId = val;
										} else {
											saveField('columnId', val);
										}
									}}
								>
									<Select.Trigger size="sm" class="h-8 text-sm flex-1">
										{getColumnDisplay()}
									</Select.Trigger>
									<Select.Content>
										<Select.Item value="none">None</Select.Item>
										{#each columnOptions as col}
											<Select.Item value={String(col.id)}>{col.name}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
						{/if}

						<!-- Swimlane -->
						{#if swimlaneOptions.length > 0}
							<div class="flex items-center gap-2">
								<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Swimlane</Label>
								<Select.Root
									type="single"
									value={isCreating ? (formData.swimlaneId ? String(formData.swimlaneId) : 'none') : (task?.swimlaneId ? String(task.swimlaneId) : 'none')}
									onValueChange={(v) => {
										const val = v === 'none' ? null : parseInt(v);
										if (isCreating) {
											formData.swimlaneId = val;
										} else {
											saveField('swimlaneId', val);
										}
									}}
								>
									<Select.Trigger size="sm" class="h-8 text-sm flex-1">
										{getSwimlaneDisplay()}
									</Select.Trigger>
									<Select.Content>
										<Select.Item value="none">None</Select.Item>
										{#each swimlaneOptions as sw}
											<Select.Item value={String(sw.id)}>{sw.name}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
						{/if}

						<hr />

						<!-- Status -->
						<div class="flex items-center gap-2">
							<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Status</Label>
							<Select.Root
								type="single"
								value={isCreating ? formData.status : task?.status}
								onValueChange={(v) => {
									if (!v) return;
									if (isCreating) {
										formData.status = v;
									} else {
										saveField('status', v);
									}
								}}
							>
								<Select.Trigger size="sm" class="h-8 text-sm flex-1">
									{taskStatuses.find(o => o.value === (isCreating ? formData.status : task?.status))?.label || 'Select'}
								</Select.Trigger>
								<Select.Content>
									{#each taskStatuses as option}
										<Select.Item value={option.value}>{option.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>

						<!-- Type -->
						<div class="flex items-center gap-2">
							<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Type</Label>
							<Select.Root
								type="single"
								value={isCreating ? (formData.type || 'none') : (task?.type || 'none')}
								onValueChange={(v) => {
									const val = v === 'none' ? null : v;
									if (isCreating) {
										formData.type = val;
									} else {
										saveField('type', val);
									}
								}}
							>
								<Select.Trigger size="sm" class="h-8 text-sm flex-1">
									{taskTypes.find(o => o.value === (isCreating ? formData.type : task?.type))?.label || 'None'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="none">None</Select.Item>
									{#each taskTypes as option}
										<Select.Item value={option.value}>{option.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>

						<!-- Category -->
						<div class="flex items-center gap-2">
							<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Category</Label>
							<Select.Root
								type="single"
								value={isCreating ? (formData.category || 'none') : (task?.category || 'none')}
								onValueChange={(v) => {
									const val = v === 'none' ? null : v;
									if (isCreating) {
										formData.category = val;
									} else {
										saveField('category', val);
									}
								}}
							>
								<Select.Trigger size="sm" class="h-8 text-sm flex-1">
									{taskCategories.find(o => o.value === (isCreating ? formData.category : task?.category))?.label || 'None'}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="none">None</Select.Item>
									{#each taskCategories as option}
										<Select.Item value={option.value}>{option.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>

						<!-- Priority -->
						<div class="flex items-center gap-2">
							<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Priority</Label>
							<Select.Root
								type="single"
								value={isCreating ? formData.priority : task?.priority}
								onValueChange={(v) => {
									if (!v) return;
									if (isCreating) {
										formData.priority = v;
									} else {
										saveField('priority', v);
									}
								}}
							>
								<Select.Trigger size="sm" class="h-8 text-sm flex-1">
									{taskPriorities.find(o => o.value === (isCreating ? formData.priority : task?.priority))?.label || 'Select'}
								</Select.Trigger>
								<Select.Content>
									{#each taskPriorities as option}
										<Select.Item value={option.value}>{option.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>

						<hr />

						<!-- Assignee -->
						<div class="flex items-center gap-2">
							<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Assignee</Label>
							<Select.Root
								type="single"
								value={isCreating ? (formData.assignedToId ? String(formData.assignedToId) : 'none') : (task?.assignedToId ? String(task.assignedToId) : 'none')}
								onValueChange={(v) => {
									const val = v === 'none' ? null : parseInt(v);
									if (isCreating) {
										formData.assignedToId = val;
									} else {
										saveField('assignedToId', val);
									}
								}}
							>
								<Select.Trigger size="sm" class="h-8 text-sm flex-1">
									{#if isCreating}
										{@const emp = formData.assignedToId ? employees.find(e => e.id === formData.assignedToId) : null}
										{emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned'}
									{:else if task?.assignedTo}
										{task.assignedTo.firstName} {task.assignedTo.lastName}
									{:else}
										Unassigned
									{/if}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="none">Unassigned</Select.Item>
									{#each employees as emp}
										<Select.Item value={String(emp.id)}>{emp.firstName} {emp.lastName}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>

						<!-- Reviewers (multi-select) -->
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Reviewers</Label>
								<Popover.Root bind:open={reviewerPopoverOpen}>
									<Popover.Trigger class="flex-1">
										<Button variant="outline" class="w-full justify-between h-8 text-sm font-normal">
											{#if reviewerIds.size > 0}
												{reviewerIds.size} selected
											{:else}
												None
											{/if}
											<ChevronsUpDown class="h-3 w-3 opacity-50" />
										</Button>
									</Popover.Trigger>
									<Popover.Content class="w-56 p-0" align="end">
										<Command.Root>
											<Command.Input placeholder="Search..." bind:value={reviewerSearch} />
											<Command.List>
												<Command.Empty>No employees found.</Command.Empty>
												<Command.Group>
													{#each filteredReviewerEmployees as emp (emp.id)}
														<Command.Item
															value="{emp.firstName} {emp.lastName}"
															onSelect={() => toggleReviewer(emp.id)}
														>
															<div class="flex items-center gap-2 w-full">
																<Checkbox checked={reviewerIds.has(emp.id)} />
																<Avatar.Root class="h-5 w-5 shrink-0">
																	<Avatar.Fallback class="text-[9px]">{getInitials(emp.firstName, emp.lastName)}</Avatar.Fallback>
																</Avatar.Root>
																<span class="text-sm truncate">{emp.firstName} {emp.lastName}</span>
																{#if reviewerIds.has(emp.id)}
																	<Check class="h-3 w-3 text-primary shrink-0 ml-auto" />
																{/if}
															</div>
														</Command.Item>
													{/each}
												</Command.Group>
											</Command.List>
										</Command.Root>
									</Popover.Content>
								</Popover.Root>
							</div>
							{#if !isCreating && task?.reviewers?.length > 0}
								<div class="flex flex-wrap gap-1 ml-[88px]">
									{#each task!.reviewers as r}
										<span class="text-xs">{r.firstName} {r.lastName}, </span>
									{/each}
								</div>
							{:else if isCreating && formData.reviewerIds.length > 0}
								<div class="flex flex-wrap gap-1 ml-[88px]">
									{#each formData.reviewerIds as rid}
										{@const emp = employees.find(e => e.id === rid)}
										{#if emp}
											<span class="text-xs">{emp.firstName} {emp.lastName}, </span>
										{/if}
									{/each}
								</div>
							{/if}
						</div>

						<!-- Followers (multi-select) -->
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Followers</Label>
								<Popover.Root bind:open={followerPopoverOpen}>
									<Popover.Trigger class="flex-1">
										<Button variant="outline" class="w-full justify-between h-8 text-sm font-normal">
											{#if followerIds.size > 0}
												{followerIds.size} selected
											{:else}
												None
											{/if}
											<ChevronsUpDown class="h-3 w-3 opacity-50" />
										</Button>
									</Popover.Trigger>
									<Popover.Content class="w-56 p-0" align="end">
										<Command.Root>
											<Command.Input placeholder="Search..." bind:value={followerSearch} />
											<Command.List>
												<Command.Empty>No employees found.</Command.Empty>
												<Command.Group>
													{#each filteredFollowerEmployees as emp (emp.id)}
														<Command.Item
															value="{emp.firstName} {emp.lastName}"
															onSelect={() => toggleFollower(emp.id)}
														>
															<div class="flex items-center gap-2 w-full">
																<Checkbox checked={followerIds.has(emp.id)} />
																<Avatar.Root class="h-5 w-5 shrink-0">
																	<Avatar.Fallback class="text-[9px]">{getInitials(emp.firstName, emp.lastName)}</Avatar.Fallback>
																</Avatar.Root>
																<span class="text-sm truncate">{emp.firstName} {emp.lastName}</span>
																{#if followerIds.has(emp.id)}
																	<Check class="h-3 w-3 text-primary shrink-0 ml-auto" />
																{/if}
															</div>
														</Command.Item>
													{/each}
												</Command.Group>
											</Command.List>
										</Command.Root>
									</Popover.Content>
								</Popover.Root>
							</div>
							{#if !isCreating && task?.followers?.length > 0}
								<div class="flex flex-wrap gap-1 ml-[88px]">
									{#each task!.followers as f}
										<span class="text-xs">{f.firstName} {f.lastName}, </span>
									{/each}
								</div>
							{:else if isCreating && formData.followerIds.length > 0}
								<div class="flex flex-wrap gap-1 ml-[88px]">
									{#each formData.followerIds as fid}
										{@const emp = employees.find(e => e.id === fid)}
										{#if emp}
											<span class="text-xs">{emp.firstName} {emp.lastName}, </span>
										{/if}
									{/each}
								</div>
							{/if}
						</div>

						<hr />

						<!-- Due Date -->
						<div class="flex items-center gap-2">
							<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Due Date {isCreating ? '*' : ''}</Label>
							<Input
								type="date"
								value={isCreating ? formData.dueDate : (task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '')}
								onchange={(e) => {
									const val = e.currentTarget.value;
									if (isCreating) {
										formData.dueDate = val;
									} else {
										saveField('dueDate', val || null);
									}
								}}
								class="h-8 text-sm flex-1"
							/>
						</div>

						<!-- Estimated Time -->
						<div class="flex items-center gap-2">
							<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Est. Time {isCreating ? '*' : ''}</Label>
							<Input
								type="number"
								step="0.5"
								min="0"
								placeholder="hours"
								value={isCreating ? (formData.estimatedTime !== null ? formData.estimatedTime : '') : (task?.estimatedTime !== null ? Number(task!.estimatedTime) : '')}
								onchange={(e) => {
									const val = e.currentTarget.value;
									if (isCreating) {
										formData.estimatedTime = val ? parseFloat(val) : null;
									} else {
										saveField('estimatedTime', val || null);
									}
								}}
								class="h-8 text-sm flex-1"
							/>
						</div>

						<!-- Spent Time (view mode only) -->
						{#if !isCreating && task}
							<div class="flex items-center gap-2">
								<Label class="text-xs text-muted-foreground w-20 shrink-0 text-right">Spent</Label>
								<p class="text-sm font-medium">
									{task.spentTime?.toFixed(2) || '0.00'}h
									{#if task.estimatedTime}
										<span class="text-muted-foreground">
											/ {Number(task.estimatedTime).toFixed(2)}h
										</span>
									{/if}
								</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
