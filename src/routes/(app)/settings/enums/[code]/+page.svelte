<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Switch } from '$lib/components/ui/switch';
	import * as Table from '$lib/components/ui/table';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import {
		ArrowLeft,
		Plus,
		Pencil,
		Trash2,
		RotateCcw,
		GripVertical,
		Star,
		Shield,
		Check,
		X,
		ArrowDownAZ
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';

	let { data } = $props();

	// Editing state
	let editingId = $state<number | null>(null);
	let editValue = $state('');
	let editLabel = $state('');
	let editDescription = $state('');

	// New value state
	let showNewRow = $state(false);
	let newValue = $state('');
	let newLabel = $state('');
	let newDescription = $state('');

	// Dialog state
	let deleteDialogOpen = $state(false);
	let restoreDialogOpen = $state(false);
	let itemToDelete = $state<{ id: number; label: string } | null>(null);
	let itemToRestore = $state<{ id: number; label: string } | null>(null);
	let isProcessing = $state(false);

	// Drag and drop state
	const flipDurationMs = 200;
	let dragDisabled = $state(true);
	let draggableItems = $state<typeof data.values>([]);

	// Update draggable items when data changes (including initial load)
	$effect(() => {
		draggableItems = data.values.filter((v) => !v.deletedAt).map((v) => ({ ...v }));
	});

	function startEdit(item: {
		id: number;
		value: string;
		label: string;
		description: string | null;
	}) {
		editingId = item.id;
		editValue = item.value;
		editLabel = item.label;
		editDescription = item.description || '';
	}

	function cancelEdit() {
		editingId = null;
		editValue = '';
		editLabel = '';
		editDescription = '';
	}

	async function saveEdit() {
		if (!editingId) return;

		isProcessing = true;
		const formData = new FormData();
		formData.append('id', String(editingId));
		formData.append('value', editValue);
		formData.append('label', editLabel);
		formData.append('description', editDescription);
		formData.append('isActive', 'true');

		const response = await fetch('?/update', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Value updated successfully');
			cancelEdit();
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to update value');
		}
		isProcessing = false;
	}

	async function createValue() {
		if (!newValue.trim() || !newLabel.trim()) {
			toast.error('Value and label are required');
			return;
		}

		isProcessing = true;
		const formData = new FormData();
		formData.append('value', newValue.trim());
		formData.append('label', newLabel.trim());
		formData.append('description', newDescription.trim());

		const response = await fetch('?/create', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Value created successfully');
			showNewRow = false;
			newValue = '';
			newLabel = '';
			newDescription = '';
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to create value');
		}
		isProcessing = false;
	}

	async function toggleActive(id: number, currentValue: boolean) {
		const item = data.values.find((v) => v.id === id);
		if (!item) return;

		isProcessing = true;
		const formData = new FormData();
		formData.append('id', String(id));
		formData.append('value', item.value);
		formData.append('label', item.label);
		formData.append('description', item.description || '');
		formData.append('isActive', String(!currentValue));

		const response = await fetch('?/update', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.type === 'success') {
			toast.success(currentValue ? 'Value deactivated' : 'Value activated');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to update value');
		}
		isProcessing = false;
	}

	async function setDefault(id: number) {
		isProcessing = true;
		const formData = new FormData();
		formData.append('id', String(id));

		const response = await fetch('?/setDefault', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Default value updated');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to set default');
		}
		isProcessing = false;
	}

	async function handleDelete() {
		if (!itemToDelete) return;

		isProcessing = true;
		const formData = new FormData();
		formData.append('id', String(itemToDelete.id));

		const response = await fetch('?/delete', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Value deleted successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete value');
		}

		isProcessing = false;
		deleteDialogOpen = false;
		itemToDelete = null;
	}

	async function handleRestore() {
		if (!itemToRestore) return;

		isProcessing = true;
		const formData = new FormData();
		formData.append('id', String(itemToRestore.id));

		const response = await fetch('?/restore', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Value restored successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to restore value');
		}

		isProcessing = false;
		restoreDialogOpen = false;
		itemToRestore = null;
	}

	function isDeleted(item: { deletedAt: Date | string | null }): boolean {
		return item.deletedAt !== null;
	}

	// Drag and drop handler
	function handleDndConsider(e: CustomEvent<{ items: typeof draggableItems }>) {
		draggableItems = e.detail.items;
	}

	async function handleDndFinalize(e: CustomEvent<{ items: typeof draggableItems }>) {
		draggableItems = e.detail.items;
		dragDisabled = true;

		// Build order updates
		const orders = draggableItems.map((item, index) => ({
			id: item.id,
			sortOrder: index
		}));

		await saveOrderBatch(orders);
	}

	async function saveOrderBatch(orders: Array<{ id: number; sortOrder: number }>) {
		isProcessing = true;
		const formData = new FormData();
		formData.append('orders', JSON.stringify(orders));

		const response = await fetch('?/reorder', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Order updated');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to reorder');
		}
		isProcessing = false;
	}

	async function sortAlphabetically() {
		const sorted = [...draggableItems].sort((a, b) => a.value.localeCompare(b.value));
		const orders = sorted.map((item, index) => ({
			id: item.id,
			sortOrder: index
		}));

		await saveOrderBatch(orders);
	}

	// Filter active values for display
	let deletedValues = $derived(data.values.filter((v) => v.deletedAt));
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/settings/enums">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<div class="flex-1">
			<div class="flex items-center gap-2">
				<h1 class="text-3xl font-bold tracking-tight">{data.enumType.name}</h1>
				{#if data.enumType.isSystem}
					<Badge variant="outline" class="gap-1">
						<Shield class="h-3 w-3" />
						System
					</Badge>
				{/if}
			</div>
			<p class="text-muted-foreground">
				{data.enumType.description || `Manage values for ${data.enumType.name}`}
			</p>
			<p class="text-sm text-muted-foreground mt-1">
				Code: <code class="bg-muted px-1.5 py-0.5 rounded">{data.enumType.code}</code>
			</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={sortAlphabetically} disabled={isProcessing || showNewRow}>
				<ArrowDownAZ class="mr-2 h-4 w-4" />
				Sort A-Z
			</Button>
			<Button onclick={() => (showNewRow = true)} disabled={showNewRow}>
				<Plus class="mr-2 h-4 w-4" />
				Add Value
			</Button>
		</div>
	</div>

	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[50px]"></Table.Head>
					<Table.Head class="w-[180px]">Value</Table.Head>
					<Table.Head class="w-[200px]">Label</Table.Head>
					<Table.Head>Description</Table.Head>
					<Table.Head class="w-[80px] text-center">Default</Table.Head>
					<Table.Head class="w-[80px] text-center">Active</Table.Head>
					{#if data.isAdmin}
						<Table.Head class="w-[80px]">Status</Table.Head>
					{/if}
					<Table.Head class="w-[120px]">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			{#if draggableItems.length > 0}
				<tbody
					use:dndzone={{ items: draggableItems, flipDurationMs, dragDisabled }}
					onconsider={handleDndConsider}
					onfinalize={handleDndFinalize}
					class="[&_tr:last-child]:border-0"
				>
					{#each draggableItems as item (item.id)}
						<tr
							animate:flip={{ duration: flipDurationMs }}
							class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
						>
						<td class="p-2 align-middle w-[50px]">
							<button
								type="button"
								class="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted"
								onmousedown={() => (dragDisabled = false)}
								ontouchstart={() => (dragDisabled = false)}
								aria-label="Drag to reorder"
							>
								<GripVertical class="h-4 w-4 text-muted-foreground" />
							</button>
						</td>
						{#if editingId === item.id}
							<td class="p-2 align-middle w-[180px]">
								<Input bind:value={editValue} class="h-8" placeholder="value_code" />
							</td>
							<td class="p-2 align-middle w-[200px]">
								<Input bind:value={editLabel} class="h-8" placeholder="Display Label" />
							</td>
							<td class="p-2 align-middle">
								<Input bind:value={editDescription} class="h-8" placeholder="Description" />
							</td>
							<td class="p-2 align-middle text-center w-[80px]">
								{#if item.isDefault}
									<Star class="h-4 w-4 text-yellow-500 mx-auto fill-yellow-500" />
								{/if}
							</td>
							<td class="p-2 align-middle text-center w-[80px]">
								<Switch checked={item.isActive} disabled />
							</td>
							{#if data.isAdmin}
								<td class="p-2 align-middle w-[80px]"></td>
							{/if}
							<td class="p-2 align-middle w-[120px]">
								<div class="flex items-center gap-1">
									<Button
										variant="ghost"
										size="icon"
										onclick={saveEdit}
										disabled={isProcessing}
										title="Save"
									>
										<Check class="h-4 w-4 text-green-600" />
									</Button>
									<Button variant="ghost" size="icon" onclick={cancelEdit} title="Cancel">
										<X class="h-4 w-4 text-red-600" />
									</Button>
								</div>
							</td>
						{:else}
							<td class="p-2 align-middle w-[180px]">
								<code class="text-sm bg-muted px-1.5 py-0.5 rounded">{item.value}</code>
							</td>
							<td class="p-2 align-middle font-medium w-[200px]">{item.label}</td>
							<td class="p-2 align-middle text-muted-foreground">{item.description || '-'}</td>
							<td class="p-2 align-middle text-center w-[80px]">
								{#if item.isDefault}
									<Star class="h-4 w-4 text-yellow-500 mx-auto fill-yellow-500" />
								{:else}
									<Button
										variant="ghost"
										size="icon"
										class="h-6 w-6"
										onclick={() => setDefault(item.id)}
										disabled={isProcessing}
										title="Set as default"
									>
										<Star class="h-4 w-4 text-muted-foreground" />
									</Button>
								{/if}
							</td>
							<td class="p-2 align-middle text-center w-[80px]">
								<Switch
									checked={item.isActive}
									onCheckedChange={() => toggleActive(item.id, item.isActive)}
									disabled={isProcessing}
								/>
							</td>
							{#if data.isAdmin}
								<td class="p-2 align-middle w-[80px]">
									<Badge variant="default">Active</Badge>
								</td>
							{/if}
							<td class="p-2 align-middle w-[120px]">
								<div class="flex items-center gap-1">
									<Button
										variant="ghost"
										size="icon"
										onclick={() => startEdit(item)}
										disabled={isProcessing}
										title="Edit"
									>
										<Pencil class="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onclick={() => {
											itemToDelete = { id: item.id, label: item.label };
											deleteDialogOpen = true;
										}}
										disabled={isProcessing}
										title="Delete"
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</td>
						{/if}
					</tr>
					{/each}
				</tbody>
			{/if}

			<tbody>
				{#if showNewRow}
					<tr class="border-b bg-muted/20">
						<td class="p-2 align-middle w-[50px]"></td>
						<td class="p-2 align-middle w-[180px]">
							<Input bind:value={newValue} class="h-8" placeholder="value_code" />
						</td>
						<td class="p-2 align-middle w-[200px]">
							<Input bind:value={newLabel} class="h-8" placeholder="Display Label" />
						</td>
						<td class="p-2 align-middle">
							<Input bind:value={newDescription} class="h-8" placeholder="Description (optional)" />
						</td>
						<td class="p-2 align-middle w-[80px]"></td>
						<td class="p-2 align-middle w-[80px]"></td>
						{#if data.isAdmin}
							<td class="p-2 align-middle w-[80px]"></td>
						{/if}
						<td class="p-2 align-middle w-[120px]">
							<div class="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									onclick={createValue}
									disabled={isProcessing}
									title="Save"
								>
									<Check class="h-4 w-4 text-green-600" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => {
										showNewRow = false;
										newValue = '';
										newLabel = '';
										newDescription = '';
									}}
									title="Cancel"
								>
									<X class="h-4 w-4 text-red-600" />
								</Button>
							</div>
						</td>
					</tr>
				{/if}

				{#if draggableItems.length === 0 && !showNewRow}
					<tr>
						<td colspan={data.isAdmin ? 8 : 7} class="h-24 text-center p-4">
							No values found. Click "Add Value" to create one.
						</td>
					</tr>
				{/if}
			</tbody>

			{#if data.isAdmin && deletedValues.length > 0}
				<tbody class="[&_tr:last-child]:border-0">
					<tr class="bg-muted/30">
						<td colspan={data.isAdmin ? 8 : 7} class="p-2 text-sm font-medium text-muted-foreground">
							Deleted Values ({deletedValues.length})
						</td>
					</tr>
					{#each deletedValues as item (item.id)}
						<tr class="border-b opacity-60">
							<td class="p-2 align-middle w-[50px]"></td>
							<td class="p-2 align-middle w-[180px]">
								<code class="text-sm bg-muted px-1.5 py-0.5 rounded">{item.value}</code>
							</td>
							<td class="p-2 align-middle font-medium w-[200px]">{item.label}</td>
							<td class="p-2 align-middle text-muted-foreground">{item.description || '-'}</td>
							<td class="p-2 align-middle text-center w-[80px]">
								{#if item.isDefault}
									<Star class="h-4 w-4 text-yellow-500 mx-auto fill-yellow-500" />
								{/if}
							</td>
							<td class="p-2 align-middle text-center w-[80px]">
								<Switch checked={item.isActive} disabled />
							</td>
							<td class="p-2 align-middle w-[80px]">
								<Badge variant="destructive">Deleted</Badge>
							</td>
							<td class="p-2 align-middle w-[120px]">
								<Button
									variant="ghost"
									size="icon"
									onclick={() => {
										itemToRestore = { id: item.id, label: item.label };
										restoreDialogOpen = true;
									}}
									disabled={isProcessing}
									title="Restore"
								>
									<RotateCcw class="h-4 w-4" />
								</Button>
							</td>
						</tr>
					{/each}
				</tbody>
			{/if}
		</Table.Root>
	</div>

	<div class="text-sm text-muted-foreground space-y-1">
		<p>
			<Star class="h-3 w-3 inline fill-yellow-500 text-yellow-500" /> marks the default value that will
			be pre-selected in forms.
		</p>
		<p>Inactive values will not appear in dropdown menus but existing data will not be affected.</p>
	</div>
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Value</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{itemToDelete?.label}</strong>? This action can be
				undone by an administrator.
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

<!-- Restore Confirmation Dialog -->
<AlertDialog.Root bind:open={restoreDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Restore Value</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to restore <strong>{itemToRestore?.label}</strong>?
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleRestore} disabled={isProcessing}>
				{isProcessing ? 'Restoring...' : 'Restore'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
