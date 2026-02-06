<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
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
		RotateCcw
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let search = $state(data.filters.search);
	let deleteDialogOpen = $state(false);
	let restoreDialogOpen = $state(false);
	let userToDelete = $state<{ id: string; name: string } | null>(null);
	let userToRestore = $state<{ id: string; name: string } | null>(null);
	let isDeleting = $state(false);
	let isRestoring = $state(false);

	const statusOptions = [
		{ value: 'active', label: 'Active users' },
		{ value: 'deleted', label: 'Deleted users' },
		{ value: 'all', label: 'All users' }
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

	function confirmDelete(user: { id: string; name: string }) {
		userToDelete = user;
		deleteDialogOpen = true;
	}

	function confirmRestore(user: { id: string; name: string }) {
		userToRestore = user;
		restoreDialogOpen = true;
	}

	async function handleDelete() {
		if (!userToDelete) return;

		isDeleting = true;
		const formData = new FormData();
		formData.append('id', userToDelete.id);

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.success('User deleted successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete user');
		}

		isDeleting = false;
		deleteDialogOpen = false;
		userToDelete = null;
	}

	async function handleRestore() {
		if (!userToRestore) return;

		isRestoring = true;
		const formData = new FormData();
		formData.append('id', userToRestore.id);

		const response = await fetch('?/restore', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.success('User restored successfully');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to restore user');
		}

		isRestoring = false;
		restoreDialogOpen = false;
		userToRestore = null;
	}

	function isUserDeleted(user: { deletedAt: string | Date | null }): boolean {
		return user.deletedAt !== null;
	}

	function canEditUser(user: { deletedAt: string | Date | null }): boolean {
		// If user is deleted, only admins can edit
		if (isUserDeleted(user)) {
			return data.isAdmin;
		}
		return true;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Users</h1>
			<p class="text-muted-foreground">Manage system users and their access</p>
		</div>
		<Button href="/users/new">
			<Plus class="mr-2 h-4 w-4" />
			Add User
		</Button>
	</div>

	<div class="flex items-center gap-4">
		<div class="relative flex-1 max-w-sm">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search users..."
				class="pl-10 pr-10"
				bind:value={search}
				onkeydown={(e) => e.key === 'Enter' && updateSearch()}
				oninput={(e) => {
					// Auto-search when cleared (x button clicked or manually cleared)
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

		{#if data.isAdmin}
			<Select.Root
				type="single"
				value={data.filters.status}
				onValueChange={updateStatus}
			>
				<Select.Trigger class="w-[180px]">
					{statusOptions.find(o => o.value === data.filters.status)?.label || 'Active users'}
				</Select.Trigger>
				<Select.Content>
					{#each statusOptions as option}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		{/if}
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
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('email')}>
							Email
							<svelte:component this={getSortIcon('email')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>Groups</Table.Head>
					{#if data.isAdmin}
						<Table.Head class="w-[100px]">Status</Table.Head>
					{/if}
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('createdAt')}>
							Created
							<svelte:component this={getSortIcon('createdAt')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head class="w-[120px]">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.users.length === 0}
					<Table.Row>
						<Table.Cell colspan={data.isAdmin ? 6 : 5} class="h-24 text-center">
							No users found.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.users as user}
						<Table.Row class={isUserDeleted(user) ? 'opacity-60' : ''}>
							<Table.Cell>
								<div class="flex items-center gap-3">
									<Avatar.Root>
										<Avatar.Fallback class="text-xs">{user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}</Avatar.Fallback>
									</Avatar.Root>
									<span class="font-medium">
										{user.name}
										{#if isUserDeleted(user)}
											<span class="text-muted-foreground text-xs ml-2">(deleted)</span>
										{/if}
									</span>
								</div>
							</Table.Cell>
							<Table.Cell>{user.email}</Table.Cell>
							<Table.Cell>
								<div class="flex flex-wrap gap-1">
									{#each user.groups as group}
										<Badge variant="secondary">{group.name}</Badge>
									{/each}
									{#if user.groups.length === 0}
										<span class="text-muted-foreground text-sm">No groups</span>
									{/if}
								</div>
							</Table.Cell>
							{#if data.isAdmin}
								<Table.Cell>
									{#if isUserDeleted(user)}
										<Badge variant="destructive">Deleted</Badge>
									{:else}
										<Badge variant="default">Active</Badge>
									{/if}
								</Table.Cell>
							{/if}
							<Table.Cell>
								{new Date(user.createdAt).toLocaleDateString()}
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-1">
									{#if canEditUser(user)}
										<Button variant="ghost" size="icon" href="/users/{user.id}/edit">
											<Pencil class="h-4 w-4" />
										</Button>
									{/if}
									{#if isUserDeleted(user)}
										{#if data.isAdmin}
											<Button
												variant="ghost"
												size="icon"
												onclick={() => confirmRestore({ id: user.id, name: user.name })}
												title="Restore user"
											>
												<RotateCcw class="h-4 w-4" />
											</Button>
										{/if}
									{:else}
										<Button
											variant="ghost"
											size="icon"
											onclick={() => confirmDelete({ id: user.id, name: user.name })}
											title="Delete user"
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									{/if}
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
				)} of {data.pagination.total} users
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
			<AlertDialog.Title>Delete User</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{userToDelete?.name}</strong>? This action can be
				undone by an administrator.
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

<!-- Restore Confirmation Dialog -->
<AlertDialog.Root bind:open={restoreDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Restore User</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to restore <strong>{userToRestore?.name}</strong>? The user will be able to log in again.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={handleRestore}
				disabled={isRestoring}
			>
				{isRestoring ? 'Restoring...' : 'Restore'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
