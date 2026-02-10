<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { saveListState, restoreListState } from '$lib/utils/list-state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Table from '$lib/components/ui/table';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Select from '$lib/components/ui/select';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
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
		Eye
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	// Persist/restore list view state
	const LIST_ROUTE = '/users';
	let _stateRestored = false;
	$effect(() => {
		if (!browser) return;
		if (!_stateRestored) {
			_stateRestored = true;
			if (!$page.url.search) {
				const saved = restoreListState(LIST_ROUTE);
				if (saved) {
					goto(LIST_ROUTE + saved, { replaceState: true });
					return;
				}
			}
		}
		saveListState(LIST_ROUTE, $page.url.search);
	});

	let search = $state(data.filters.search);
	let deleteDialogOpen = $state(false);
	let userToDelete = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);

	// Checkbox selection / bulk delete state
	let selectedIds = $state<Set<number>>(new Set());
	let bulkDeleteDialogOpen = $state(false);
	let isBulkDeleting = $state(false);

	let allSelected = $derived(data.users.length > 0 && selectedIds.size === data.users.length);
	let someSelected = $derived(selectedIds.size > 0 && selectedIds.size < data.users.length);

	// Filter state
	let statusFilter = $state(data.filters.status);
	let departmentFilter = $state(data.filters.department);

	function toggleSelectAll() {
		if (allSelected) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(data.users.map((u) => u.id));
		}
	}

	function toggleSelect(id: number) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

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

	function updateFilter(key: string, value: string) {
		const url = new URL($page.url);
		if (value) {
			url.searchParams.set(key, value);
		} else {
			url.searchParams.delete(key);
		}
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

	function confirmDelete(user: { id: number; name: string }) {
		userToDelete = user;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!userToDelete) return;

		isDeleting = true;
		const formData = new FormData();
		formData.append('id', String(userToDelete.id));

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.success('User deleted successfully');
			selectedIds = new Set();
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete user');
		}

		isDeleting = false;
		deleteDialogOpen = false;
		userToDelete = null;
	}

	async function handleBulkDelete() {
		if (selectedIds.size === 0) return;

		isBulkDeleting = true;
		const formData = new FormData();
		formData.append('ids', Array.from(selectedIds).join(','));

		const response = await fetch('?/bulkDelete', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'success') {
			toast.success(`${result.data?.count || selectedIds.size} user(s) deleted successfully`);
			selectedIds = new Set();
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete users');
		}

		isBulkDeleting = false;
		bulkDeleteDialogOpen = false;
	}

	function formatCurrency(amount: number | null): string {
		if (amount === null || amount === undefined) return '-';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function getInitials(user: { name: string; firstName?: string | null; lastName?: string | null }): string {
		if (user.firstName && user.lastName) {
			return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
		}
		return user.name
			.split(' ')
			.map((w: string) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function getDisplayName(user: { name: string; firstName?: string | null; lastName?: string | null }): string {
		if (user.firstName && user.lastName) {
			return `${user.firstName} ${user.lastName}`;
		}
		return user.name;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Users</h1>
			<p class="text-muted-foreground">Manage system users and their access</p>
		</div>
		<div class="flex items-center gap-2">
			{#if selectedIds.size > 0}
				<Button
					variant="destructive"
					onclick={() => (bulkDeleteDialogOpen = true)}
				>
					<Trash2 class="mr-2 h-4 w-4" />
					Delete ({selectedIds.size})
				</Button>
			{/if}
			<Button href="/users/new">
				<Plus class="mr-2 h-4 w-4" />
				Add User
			</Button>
		</div>
	</div>

	<div class="flex items-center gap-4 flex-wrap">
		<div class="relative flex-1 max-w-sm">
			<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search users..."
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
			value={statusFilter}
			onValueChange={(v) => {
				statusFilter = v || '';
				updateFilter('status', statusFilter);
			}}
		>
			<Select.Trigger class="w-[160px]">
				{data.enums.employee_status.find((s) => s.value === statusFilter)?.label || 'All Statuses'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All Statuses</Select.Item>
				{#each data.enums.employee_status as status}
					<Select.Item value={status.value}>{status.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Select.Root
			type="single"
			value={departmentFilter}
			onValueChange={(v) => {
				departmentFilter = v || '';
				updateFilter('department', departmentFilter);
			}}
		>
			<Select.Trigger class="w-[180px]">
				{data.enums.department.find((d) => d.value === departmentFilter)?.label || 'All Departments'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All Departments</Select.Item>
				{#each data.enums.department as dept}
					<Select.Item value={dept.value}>{dept.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[50px]">
						<Checkbox
							checked={allSelected}
							indeterminate={someSelected}
							onCheckedChange={toggleSelectAll}
						/>
					</Table.Head>
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
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('jobTitle')}>
							Job Title
							<svelte:component this={getSortIcon('jobTitle')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => updateSort('department')}>
							Department
							<svelte:component this={getSortIcon('department')} class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>Status</Table.Head>
					{#if data.canViewSalary}
						<Table.Head class="text-right">
							<Button variant="ghost" class="-ml-4" onclick={() => updateSort('salary')}>
								Salary
								<svelte:component this={getSortIcon('salary')} class="ml-2 h-4 w-4" />
							</Button>
						</Table.Head>
					{/if}
					<Table.Head>Groups</Table.Head>
					<Table.Head class="w-[120px]">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if data.users.length === 0}
					<Table.Row>
						<Table.Cell colspan={data.canViewSalary ? 9 : 8} class="h-24 text-center">
							No users found.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each data.users as user}
						<Table.Row
							class="cursor-pointer hover:bg-muted/50"
							onclick={() => goto(`/users/${user.id}`)}
						>
							<Table.Cell onclick={(e) => e.stopPropagation()}>
								<Checkbox
									checked={selectedIds.has(user.id)}
									onCheckedChange={() => toggleSelect(user.id)}
								/>
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-3">
									<Avatar.Root>
										{#if user.image}
											<Avatar.Image src="/api/uploads/{user.image}" alt={getDisplayName(user)} />
										{/if}
										<Avatar.Fallback class="text-xs">{getInitials(user)}</Avatar.Fallback>
									</Avatar.Root>
									<span class="font-medium">
										{getDisplayName(user)}
									</span>
								</div>
							</Table.Cell>
							<Table.Cell>{user.email}</Table.Cell>
							<Table.Cell>
								{user.jobTitle || '-'}
							</Table.Cell>
							<Table.Cell>
								{#if user.department}
									<EnumBadge enums={data.enums.department} value={user.department} />
								{:else}
									<span class="text-muted-foreground text-sm">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if user.employeeStatus}
									<EnumBadge enums={data.enums.employee_status} value={user.employeeStatus} />
								{:else}
									<span class="text-muted-foreground text-sm">-</span>
								{/if}
							</Table.Cell>
							{#if data.canViewSalary}
								<Table.Cell class="text-right">
									{formatCurrency(user.salary)}
								</Table.Cell>
							{/if}
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
							<Table.Cell>
								<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
									<Button variant="ghost" size="icon" href="/users/{user.id}">
										<Eye class="h-4 w-4" />
									</Button>
									<Button variant="ghost" size="icon" href="/users/{user.id}/edit">
										<Pencil class="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onclick={() => confirmDelete({ id: user.id, name: getDisplayName(user) })}
										title="Delete user"
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
				Are you sure you want to delete <strong>{userToDelete?.name}</strong>? This action cannot be undone.
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

<!-- Bulk Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={bulkDeleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {selectedIds.size} User(s)</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{selectedIds.size}</strong> selected user(s)? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				onclick={handleBulkDelete}
				disabled={isBulkDeleting}
			>
				{isBulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} User(s)`}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
