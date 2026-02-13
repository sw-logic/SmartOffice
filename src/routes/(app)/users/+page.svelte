<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { saveListState, restoreListState } from '$lib/utils/list-state';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Table from '$lib/components/ui/table';
	import UserAvatar from '$lib/components/shared/UserAvatar.svelte';
	import * as Select from '$lib/components/ui/select';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import { ListSearch, SortableHeader, ListPagination, DeleteConfirmDialog, BulkDeleteButton } from '$lib/components/shared/list';
	import {
		Plus,
		Pencil,
		Trash2,
		Eye
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';
	import { createCurrencyFormatter } from '$lib/utils/currency';

	let { data } = $props();

	const fmt = createCurrencyFormatter(data.enums.currency);

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

	let deleteDialogOpen = $state(false);
	let userToDelete = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);

	// Checkbox selection / bulk delete state
	let selectedIds = $state<Set<number>>(new Set());
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
			<BulkDeleteButton
				count={selectedIds.size}
				noun="user"
				isDeleting={isBulkDeleting}
				onconfirm={handleBulkDelete}
			/>
			<Button href="/users/new">
				<Plus class="mr-2 h-4 w-4" />
				Add User
			</Button>
		</div>
	</div>

	<div class="flex items-center gap-4 flex-wrap">
		<ListSearch placeholder="Search users..." />

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
					<SortableHeader column="name" label="Name" class="w-[250px]" />
					<SortableHeader column="email" label="Email" />
					<SortableHeader column="jobTitle" label="Job Title" />
					<SortableHeader column="department" label="Department" />
					<Table.Head>Status</Table.Head>
					{#if data.canViewSalary}
						<SortableHeader column="salary" label="Salary" class="text-right" />
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
									<UserAvatar user={user} />
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
									{fmt.format(user.salary)}
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

	<ListPagination pagination={data.pagination} noun="users" />
</div>

<DeleteConfirmDialog
	bind:open={deleteDialogOpen}
	title="Delete User"
	name={userToDelete?.name}
	{isDeleting}
	onconfirm={handleDelete}
/>
