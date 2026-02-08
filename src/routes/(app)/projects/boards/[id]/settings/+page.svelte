<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Card from '$lib/components/ui/card';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import * as Select from '$lib/components/ui/select';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import {
		ArrowLeft,
		Plus,
		Pencil,
		Trash2,
		RotateCcw,
		GripVertical,
		Check,
		X,
		ChevronsUpDown
	} from 'lucide-svelte';
	import ColorInput from '$lib/components/shared/ColorInput.svelte';
	import { toast } from 'svelte-sonner';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';

	let { data } = $props();

	// ── Column state ──
	let showNewColumn = $state(false);
	let newColumnName = $state('');
	let newColumnColor = $state('');
	let editingColumnId = $state<number | null>(null);
	let editColumnName = $state('');
	let editColumnColor = $state('');

	// ── Swimlane state ──
	let showNewSwimlane = $state(false);
	let newSwimlaneName = $state('');
	let newSwimlaneColor = $state('');
	let editingSwimlaneId = $state<number | null>(null);
	let editSwimlaneName = $state('');
	let editSwimlaneColor = $state('');

	// ── Member state ──
	let memberPopoverOpen = $state(false);
	let memberSearchQuery = $state('');
	let isUpdatingMembers = $state(false);

	let selectedMemberIds = $derived(
		new Set(data.members.map((m) => m.personId))
	);

	let filteredEmployees = $derived(
		data.allProjectEmployees.filter((emp) => {
			if (!memberSearchQuery) return true;
			const q = memberSearchQuery.toLowerCase();
			return `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q);
		})
	);

	// ── Shared state ──
	let isProcessing = $state(false);
	let deleteDialogOpen = $state(false);
	let deleteTarget = $state<{ type: 'column' | 'swimlane'; id: number; name: string } | null>(null);

	// ── DnD state ──
	const flipDurationMs = 200;
	let columnDragDisabled = $state(true);
	let swimlaneDragDisabled = $state(true);

	type ColumnItem = {
		id: number;
		name: string;
		order: number;
		color: string | null;
		deletedAt: Date | string | null;
		taskCount: number;
	};

	type SwimlaneItem = {
		id: number;
		name: string;
		order: number;
		color: string | null;
		deletedAt: Date | string | null;
		taskCount: number;
	};

	let draggableColumns = $state<ColumnItem[]>([]);
	let draggableSwimlanes = $state<SwimlaneItem[]>([]);

	$effect(() => {
		draggableColumns = data.columns.filter((c) => !c.deletedAt).map((c) => ({ ...c }));
	});
	$effect(() => {
		draggableSwimlanes = data.swimlanes.filter((s) => !s.deletedAt).map((s) => ({ ...s }));
	});

	let deletedColumns = $derived(data.columns.filter((c) => c.deletedAt));
	let deletedSwimlanes = $derived(data.swimlanes.filter((s) => s.deletedAt));

	// ── Helper: fetch form action ──
	async function postAction(
		action: string,
		formDataEntries: Record<string, string>
	): Promise<{ type: string; data?: { error?: string } }> {
		const formData = new FormData();
		for (const [k, v] of Object.entries(formDataEntries)) {
			formData.append(k, v);
		}
		const response = await fetch(`?/${action}`, { method: 'POST', body: formData });
		return response.json();
	}

	// ── Column actions ──
	async function createColumn() {
		if (!newColumnName.trim()) {
			toast.error('Name is required');
			return;
		}
		isProcessing = true;
		const result = await postAction('addColumn', {
			name: newColumnName.trim(),
			color: newColumnColor.trim()
		});
		if (result.type === 'success') {
			toast.success('Column added');
			showNewColumn = false;
			newColumnName = '';
			newColumnColor = '';
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to add column');
		}
		isProcessing = false;
	}

	function startEditColumn(col: ColumnItem) {
		editingColumnId = col.id;
		editColumnName = col.name;
		editColumnColor = col.color || '';
	}

	function cancelEditColumn() {
		editingColumnId = null;
		editColumnName = '';
		editColumnColor = '';
	}

	async function saveEditColumn() {
		if (!editingColumnId || !editColumnName.trim()) return;
		isProcessing = true;
		const result = await postAction('updateColumn', {
			id: String(editingColumnId),
			name: editColumnName.trim(),
			color: editColumnColor.trim()
		});
		if (result.type === 'success') {
			toast.success('Column updated');
			cancelEditColumn();
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to update column');
		}
		isProcessing = false;
	}

	// ── Swimlane actions ──
	async function createSwimlane() {
		if (!newSwimlaneName.trim()) {
			toast.error('Name is required');
			return;
		}
		isProcessing = true;
		const result = await postAction('addSwimlane', {
			name: newSwimlaneName.trim(),
			color: newSwimlaneColor.trim()
		});
		if (result.type === 'success') {
			toast.success('Swimlane added');
			showNewSwimlane = false;
			newSwimlaneName = '';
			newSwimlaneColor = '';
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to add swimlane');
		}
		isProcessing = false;
	}

	function startEditSwimlane(sl: SwimlaneItem) {
		editingSwimlaneId = sl.id;
		editSwimlaneName = sl.name;
		editSwimlaneColor = sl.color || '';
	}

	function cancelEditSwimlane() {
		editingSwimlaneId = null;
		editSwimlaneName = '';
		editSwimlaneColor = '';
	}

	async function saveEditSwimlane() {
		if (!editingSwimlaneId || !editSwimlaneName.trim()) return;
		isProcessing = true;
		const result = await postAction('updateSwimlane', {
			id: String(editingSwimlaneId),
			name: editSwimlaneName.trim(),
			color: editSwimlaneColor.trim()
		});
		if (result.type === 'success') {
			toast.success('Swimlane updated');
			cancelEditSwimlane();
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to update swimlane');
		}
		isProcessing = false;
	}

	// ── Delete (columns/swimlanes) ──
	async function handleDelete() {
		if (!deleteTarget) return;
		isProcessing = true;

		const action = deleteTarget.type === 'column' ? 'deleteColumn' : 'deleteSwimlane';
		const result = await postAction(action, { id: String(deleteTarget.id) });

		if (result.type === 'success') {
			toast.success(`${deleteTarget.type === 'column' ? 'Column' : 'Swimlane'} deleted`);
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Operation failed');
		}

		isProcessing = false;
		deleteDialogOpen = false;
		deleteTarget = null;
	}

	// ── Restore ──
	async function restoreColumn(id: number) {
		isProcessing = true;
		const result = await postAction('restoreColumn', { id: String(id) });
		if (result.type === 'success') {
			toast.success('Column restored');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to restore column');
		}
		isProcessing = false;
	}

	async function restoreSwimlane(id: number) {
		isProcessing = true;
		const result = await postAction('restoreSwimlane', { id: String(id) });
		if (result.type === 'success') {
			toast.success('Swimlane restored');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to restore swimlane');
		}
		isProcessing = false;
	}

	// ── DnD handlers ──
	function handleColumnDndConsider(e: CustomEvent<{ items: ColumnItem[] }>) {
		draggableColumns = e.detail.items;
	}

	async function handleColumnDndFinalize(e: CustomEvent<{ items: ColumnItem[] }>) {
		draggableColumns = e.detail.items;
		columnDragDisabled = true;

		const orders = draggableColumns.map((item, index) => ({ id: item.id, order: index }));
		isProcessing = true;
		const result = await postAction('reorderColumns', { orders: JSON.stringify(orders) });
		if (result.type === 'success') {
			toast.success('Order updated');
			invalidateAll();
		} else {
			toast.error('Failed to reorder');
		}
		isProcessing = false;
	}

	function handleSwimlaneDndConsider(e: CustomEvent<{ items: SwimlaneItem[] }>) {
		draggableSwimlanes = e.detail.items;
	}

	async function handleSwimlaneDndFinalize(e: CustomEvent<{ items: SwimlaneItem[] }>) {
		draggableSwimlanes = e.detail.items;
		swimlaneDragDisabled = true;

		const orders = draggableSwimlanes.map((item, index) => ({ id: item.id, order: index }));
		isProcessing = true;
		const result = await postAction('reorderSwimlanes', { orders: JSON.stringify(orders) });
		if (result.type === 'success') {
			toast.success('Order updated');
			invalidateAll();
		} else {
			toast.error('Failed to reorder');
		}
		isProcessing = false;
	}

	// ── Member actions ──
	async function toggleMember(personId: number) {
		if (isUpdatingMembers) return;
		isUpdatingMembers = true;

		const newIds = new Set(selectedMemberIds);
		if (newIds.has(personId)) {
			newIds.delete(personId);
		} else {
			newIds.add(personId);
		}

		const result = await postAction('updateMembers', {
			personIds: JSON.stringify([...newIds])
		});
		if (result.type === 'success') {
			toast.success('Members updated');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to update members');
		}
		isUpdatingMembers = false;
	}

	async function updateMemberRole(personId: number, role: string) {
		isProcessing = true;
		const result = await postAction('updateMemberRole', {
			personId: String(personId),
			role
		});
		if (result.type === 'success') {
			toast.success('Role updated');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to update role');
		}
		isProcessing = false;
	}

	function getInitials(firstName: string, lastName: string): string {
		return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/projects/boards/{data.board.id}">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Board Settings</h1>
			<p class="text-muted-foreground">
				{data.board.name} &mdash; {data.board.projectName}
				<span class="text-xs">({data.board.clientName})</span>
			</p>
		</div>
	</div>

	<!-- 3-column layout -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- ═══════ COLUMNS ═══════ -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
				<Card.Title class="text-lg">Columns</Card.Title>
				<Button
					size="sm"
					variant="outline"
					onclick={() => (showNewColumn = true)}
					disabled={showNewColumn}
				>
					<Plus class="mr-1 h-4 w-4" />
					Add
				</Button>
			</Card.Header>
			<Card.Content class="space-y-1">
				{#if showNewColumn}
					<div class="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
						<Input
							bind:value={newColumnName}
							class="h-8 flex-1"
							placeholder="Column name"
							onkeydown={(e) => e.key === 'Enter' && createColumn()}
						/>
						<ColorInput bind:value={newColumnColor} />
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 shrink-0"
							onclick={createColumn}
							disabled={isProcessing}
						>
							<Check class="h-4 w-4 text-green-600" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 shrink-0"
							onclick={() => {
								showNewColumn = false;
								newColumnName = '';
								newColumnColor = '';
							}}
						>
							<X class="h-4 w-4 text-red-600" />
						</Button>
					</div>
				{/if}

				{#if draggableColumns.length > 0}
					<div
						use:dndzone={{ items: draggableColumns, flipDurationMs, dragDisabled: columnDragDisabled }}
						onconsider={handleColumnDndConsider}
						onfinalize={handleColumnDndFinalize}
						class="space-y-1"
					>
						{#each draggableColumns as col (col.id)}
							<div
								animate:flip={{ duration: flipDurationMs }}
								class="flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-muted/30"
							>
								<button
									type="button"
									class="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted shrink-0"
									onmousedown={() => (columnDragDisabled = false)}
									ontouchstart={() => (columnDragDisabled = false)}
									aria-label="Drag to reorder"
								>
									<GripVertical class="h-4 w-4 text-muted-foreground" />
								</button>

								{#if editingColumnId === col.id}
									<Input
										bind:value={editColumnName}
										class="h-7 flex-1"
										onkeydown={(e) => e.key === 'Enter' && saveEditColumn()}
									/>
									<ColorInput bind:value={editColumnColor} size="sm" />
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 shrink-0"
										onclick={saveEditColumn}
										disabled={isProcessing}
									>
										<Check class="h-3.5 w-3.5 text-green-600" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 shrink-0"
										onclick={cancelEditColumn}
									>
										<X class="h-3.5 w-3.5 text-red-600" />
									</Button>
								{:else}
									{#if col.color}
										<span
											class="inline-block h-3 w-3 rounded-full shrink-0"
											style="background-color: {col.color}"
										></span>
									{/if}
									<span class="text-sm flex-1 truncate">{col.name}</span>
									<Badge variant="secondary" class="text-xs shrink-0">{col.taskCount}</Badge>
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 shrink-0"
										onclick={() => startEditColumn(col)}
										disabled={isProcessing}
									>
										<Pencil class="h-3.5 w-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 shrink-0"
										onclick={() => {
											deleteTarget = { type: 'column', id: col.id, name: col.name };
											deleteDialogOpen = true;
										}}
										disabled={isProcessing}
									>
										<Trash2 class="h-3.5 w-3.5" />
									</Button>
								{/if}
							</div>
						{/each}
					</div>
				{:else if !showNewColumn}
					<p class="text-sm text-muted-foreground text-center py-4">No columns yet.</p>
				{/if}

				{#if data.isAdmin && deletedColumns.length > 0}
					<div class="pt-3 border-t mt-3">
						<p class="text-xs text-muted-foreground font-medium mb-2">
							Deleted ({deletedColumns.length})
						</p>
						{#each deletedColumns as col (col.id)}
							<div class="flex items-center gap-2 p-2 rounded-md opacity-60">
								{#if col.color}
									<span
										class="inline-block h-3 w-3 rounded-full shrink-0"
										style="background-color: {col.color}"
									></span>
								{/if}
								<span class="text-sm flex-1 truncate">{col.name}</span>
								<Button
									variant="ghost"
									size="icon"
									class="h-7 w-7 shrink-0"
									onclick={() => restoreColumn(col.id)}
									disabled={isProcessing}
									title="Restore"
								>
									<RotateCcw class="h-3.5 w-3.5" />
								</Button>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- ═══════ SWIMLANES ═══════ -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
				<Card.Title class="text-lg">Swimlanes</Card.Title>
				<Button
					size="sm"
					variant="outline"
					onclick={() => (showNewSwimlane = true)}
					disabled={showNewSwimlane}
				>
					<Plus class="mr-1 h-4 w-4" />
					Add
				</Button>
			</Card.Header>
			<Card.Content class="space-y-1">
				{#if showNewSwimlane}
					<div class="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
						<Input
							bind:value={newSwimlaneName}
							class="h-8 flex-1"
							placeholder="Swimlane name"
							onkeydown={(e) => e.key === 'Enter' && createSwimlane()}
						/>
						<ColorInput bind:value={newSwimlaneColor} />
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 shrink-0"
							onclick={createSwimlane}
							disabled={isProcessing}
						>
							<Check class="h-4 w-4 text-green-600" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 shrink-0"
							onclick={() => {
								showNewSwimlane = false;
								newSwimlaneName = '';
								newSwimlaneColor = '';
							}}
						>
							<X class="h-4 w-4 text-red-600" />
						</Button>
					</div>
				{/if}

				{#if draggableSwimlanes.length > 0}
					<div
						use:dndzone={{
							items: draggableSwimlanes,
							flipDurationMs,
							dragDisabled: swimlaneDragDisabled
						}}
						onconsider={handleSwimlaneDndConsider}
						onfinalize={handleSwimlaneDndFinalize}
						class="space-y-1"
					>
						{#each draggableSwimlanes as sl (sl.id)}
							<div
								animate:flip={{ duration: flipDurationMs }}
								class="flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-muted/30"
							>
								<button
									type="button"
									class="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted shrink-0"
									onmousedown={() => (swimlaneDragDisabled = false)}
									ontouchstart={() => (swimlaneDragDisabled = false)}
									aria-label="Drag to reorder"
								>
									<GripVertical class="h-4 w-4 text-muted-foreground" />
								</button>

								{#if editingSwimlaneId === sl.id}
									<Input
										bind:value={editSwimlaneName}
										class="h-7 flex-1"
										onkeydown={(e) => e.key === 'Enter' && saveEditSwimlane()}
									/>
									<ColorInput bind:value={editSwimlaneColor} size="sm" />
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 shrink-0"
										onclick={saveEditSwimlane}
										disabled={isProcessing}
									>
										<Check class="h-3.5 w-3.5 text-green-600" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 shrink-0"
										onclick={cancelEditSwimlane}
									>
										<X class="h-3.5 w-3.5 text-red-600" />
									</Button>
								{:else}
									{#if sl.color}
										<span
											class="inline-block h-3 w-3 rounded-full shrink-0"
											style="background-color: {sl.color}"
										></span>
									{/if}
									<span class="text-sm flex-1 truncate">{sl.name}</span>
									<Badge variant="secondary" class="text-xs shrink-0">{sl.taskCount}</Badge>
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 shrink-0"
										onclick={() => startEditSwimlane(sl)}
										disabled={isProcessing}
									>
										<Pencil class="h-3.5 w-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 shrink-0"
										onclick={() => {
											deleteTarget = { type: 'swimlane', id: sl.id, name: sl.name };
											deleteDialogOpen = true;
										}}
										disabled={isProcessing}
									>
										<Trash2 class="h-3.5 w-3.5" />
									</Button>
								{/if}
							</div>
						{/each}
					</div>
				{:else if !showNewSwimlane}
					<p class="text-sm text-muted-foreground text-center py-4">No swimlanes yet.</p>
				{/if}

				{#if data.isAdmin && deletedSwimlanes.length > 0}
					<div class="pt-3 border-t mt-3">
						<p class="text-xs text-muted-foreground font-medium mb-2">
							Deleted ({deletedSwimlanes.length})
						</p>
						{#each deletedSwimlanes as sl (sl.id)}
							<div class="flex items-center gap-2 p-2 rounded-md opacity-60">
								{#if sl.color}
									<span
										class="inline-block h-3 w-3 rounded-full shrink-0"
										style="background-color: {sl.color}"
									></span>
								{/if}
								<span class="text-sm flex-1 truncate">{sl.name}</span>
								<Button
									variant="ghost"
									size="icon"
									class="h-7 w-7 shrink-0"
									onclick={() => restoreSwimlane(sl.id)}
									disabled={isProcessing}
									title="Restore"
								>
									<RotateCcw class="h-3.5 w-3.5" />
								</Button>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- ═══════ ACCESS / MEMBERS ═══════ -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
				<Card.Title class="text-lg">Access</Card.Title>
				{#if data.allProjectEmployees.length > 0}
					<Popover.Root bind:open={memberPopoverOpen}>
						<Popover.Trigger>
							<Button variant="outline" size="sm" class="h-7 gap-1">
								<ChevronsUpDown class="h-3 w-3" />
								Manage
							</Button>
						</Popover.Trigger>
						<Popover.Content class="w-64 p-0" align="end">
							<Command.Root>
								<Command.Input
									placeholder="Search employees..."
									bind:value={memberSearchQuery}
								/>
								<Command.List>
									<Command.Empty>No employees found.</Command.Empty>
									<Command.Group>
										{#each filteredEmployees as employee (employee.id)}
											<Command.Item
												value="{employee.firstName} {employee.lastName}"
												onSelect={() => toggleMember(employee.id)}
											>
												<div class="flex items-center gap-2 w-full">
													<Checkbox
														checked={selectedMemberIds.has(employee.id)}
														disabled={isUpdatingMembers}
													/>
													<Avatar.Root class="h-6 w-6 shrink-0">
														<Avatar.Fallback class="text-[10px]">
															{getInitials(employee.firstName, employee.lastName)}
														</Avatar.Fallback>
													</Avatar.Root>
													<div class="flex-1 min-w-0">
														<p class="text-sm truncate">
															{employee.firstName} {employee.lastName}
														</p>
														{#if employee.jobTitle}
															<p class="text-xs text-muted-foreground truncate">
																{employee.jobTitle}
															</p>
														{/if}
													</div>
													{#if selectedMemberIds.has(employee.id)}
														<Check class="h-4 w-4 text-primary shrink-0" />
													{/if}
												</div>
											</Command.Item>
										{/each}
									</Command.Group>
								</Command.List>
							</Command.Root>
						</Popover.Content>
					</Popover.Root>
				{/if}
			</Card.Header>
			<Card.Content class="space-y-1">
				{#if data.members.length > 0}
					{#each data.members as member (member.personId)}
						<div
							class="flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-muted/30"
						>
							<Avatar.Root class="h-8 w-8 shrink-0">
								<Avatar.Fallback class="text-xs">
									{getInitials(member.firstName, member.lastName)}
								</Avatar.Fallback>
							</Avatar.Root>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium truncate">
									{member.firstName} {member.lastName}
								</p>
								{#if member.jobTitle}
									<p class="text-xs text-muted-foreground truncate">
										{member.jobTitle}
									</p>
								{/if}
							</div>
							<Select.Root
								type="single"
								value={member.role}
								onValueChange={(v) => {
									if (v) updateMemberRole(member.personId, v);
								}}
							>
								<Select.Trigger class="h-7 w-[100px] text-xs">
									{member.role}
								</Select.Trigger>
								<Select.Content>
									<Select.Item value="member">member</Select.Item>
									<Select.Item value="viewer">viewer</Select.Item>
								</Select.Content>
							</Select.Root>
						</div>
					{/each}
				{:else}
					<p class="text-sm text-muted-foreground text-center py-4">
						No members assigned to this board.
					</p>
				{/if}

				{#if data.allProjectEmployees.length === 0}
					<p class="text-xs text-muted-foreground">
						No project employees available. Assign employees to the project first.
					</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>
				Delete {deleteTarget?.type === 'column' ? 'Column' : 'Swimlane'}
			</AlertDialog.Title>
			<AlertDialog.Description>
				Delete <strong>{deleteTarget?.name}</strong>? This can be undone by an administrator.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				onclick={handleDelete}
				disabled={isProcessing}
			>
				{isProcessing ? 'Deleting...' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
