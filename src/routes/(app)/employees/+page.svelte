<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { saveListState, restoreListState } from '$lib/utils/list-state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Avatar from '$lib/components/ui/avatar';
	import {
		Plus,
		Search,
		ArrowUpDown,
		Trash2,
		Eye,
		Pencil,
		User,
		Briefcase
	} from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	// Persist/restore list view state
	const LIST_ROUTE = '/employees';
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

	let searchInput = $state(data.filters.search);
	let deleteDialogOpen = $state(false);
	let bulkDeleteDialogOpen = $state(false);
	let selectedEmployee = $state<{ id: number; firstName: string; lastName: string; hasUser: boolean } | null>(null);
	let selectedIds = $state<Set<number>>(new Set());
	let deactivateUser = $state(false);
	let deactivateUsers = $state(false);

	const allSelected = $derived(
		data.employees.length > 0 && data.employees.every((e: { id: number }) => selectedIds.has(e.id))
	);

	const someSelected = $derived(selectedIds.size > 0);

	const selectedWithUsers = $derived(
		data.employees.filter((e: { id: number; user: unknown }) => selectedIds.has(e.id) && e.user)
	);

	function toggleSelectAll() {
		if (allSelected) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(data.employees.map((e: { id: number }) => e.id));
		}
	}

	function toggleSelect(id: number) {
		const next = new Set(selectedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selectedIds = next;
	}

	const employmentTypes = [
		{ value: 'full-time', label: 'Full-time' },
		{ value: 'part-time', label: 'Part-time' },
		{ value: 'contractor', label: 'Contractor' }
	];

	const statusOptions = [
		{ value: 'active', label: 'Active' },
		{ value: 'on_leave', label: 'On Leave' },
		{ value: 'terminated', label: 'Terminated' }
	];

	function updateFilter(key: string, value: string) {
		const params = new URLSearchParams($page.url.searchParams);
		if (value) {
			params.set(key, value);
		} else {
			params.delete(key);
		}
		params.delete('page');
		goto(`?${params.toString()}`);
	}

	function handleSearch() {
		updateFilter('search', searchInput);
	}

	function toggleSort(column: string) {
		const params = new URLSearchParams($page.url.searchParams);
		const currentSort = params.get('sortBy');
		const currentOrder = params.get('sortOrder') || 'asc';

		if (currentSort === column) {
			params.set('sortOrder', currentOrder === 'asc' ? 'desc' : 'asc');
		} else {
			params.set('sortBy', column);
			params.set('sortOrder', 'asc');
		}
		params.delete('page');
		goto(`?${params.toString()}`);
	}

	function openDeleteDialog(employee: { id: number; firstName: string; lastName: string; hasUser: boolean }) {
		selectedEmployee = employee;
		deactivateUser = false;
		deleteDialogOpen = true;
	}

	function formatCurrency(amount: number | null): string {
		if (amount === null) return '-';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Employees</h1>
			<p class="text-muted-foreground">Manage your company employees</p>
		</div>
		<div class="flex items-center gap-2">
			{#if someSelected}
				<Button variant="destructive" onclick={() => { deactivateUsers = false; bulkDeleteDialogOpen = true; }}>
					<Trash2 class="mr-2 h-4 w-4" />
					Delete ({selectedIds.size})
				</Button>
			{/if}
			<Button href="/employees/new">
				<Plus class="mr-2 h-4 w-4" />
				Add Employee
			</Button>
		</div>
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-4">
		<div class="flex items-center gap-2">
			<Input
				type="search"
				placeholder="Search employees..."
				class="w-64"
				bind:value={searchInput}
				onkeydown={(e) => e.key === 'Enter' && handleSearch()}
			/>
			<Button variant="outline" size="icon" onclick={handleSearch}>
				<Search class="h-4 w-4" />
			</Button>
		</div>

		<Select.Root
			type="single"
			value={data.filters.status}
			onValueChange={(v) => updateFilter('status', v)}
		>
			<Select.Trigger class="w-40">
				{statusOptions.find((o) => o.value === data.filters.status)?.label || 'All Status'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="all">All Status</Select.Item>
				{#each statusOptions as option}
					<Select.Item value={option.value}>{option.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		{#if data.departments.length > 0}
			<Select.Root
				type="single"
				value={data.filters.department}
				onValueChange={(v) => updateFilter('department', v)}
			>
				<Select.Trigger class="w-40">
					{data.filters.department || 'All Departments'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">All Departments</Select.Item>
					{#each data.departments as dept}
						<Select.Item value={dept}>{dept}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		{/if}

		<Select.Root
			type="single"
			value={data.filters.employmentType}
			onValueChange={(v) => updateFilter('employmentType', v)}
		>
			<Select.Trigger class="w-40">
				{employmentTypes.find((t) => t.value === data.filters.employmentType)?.label ||
					'All Types'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All Types</Select.Item>
				{#each employmentTypes as type}
					<Select.Item value={type.value}>{type.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	<!-- Table -->
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[40px]">
						<Checkbox
							checked={allSelected}
							onCheckedChange={() => toggleSelectAll()}
						/>
					</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => toggleSort('lastName')}>
							Name
							<ArrowUpDown class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>Contact</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => toggleSort('department')}>
							Department
							<ArrowUpDown class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>Job Title</Table.Head>
					<Table.Head>Type</Table.Head>
					<Table.Head>Status</Table.Head>
					{#if data.canViewSalary}
						<Table.Head class="text-right">Salary</Table.Head>
					{/if}
					<Table.Head>Projects</Table.Head>
					<Table.Head class="w-[100px]">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.employees as employee}
					<Table.Row
						class="cursor-pointer hover:bg-muted/50"
						onclick={() => goto(`/employees/${employee.id}`)}
					>
						<Table.Cell onclick={(e) => e.stopPropagation()}>
							<Checkbox
								checked={selectedIds.has(employee.id)}
								onCheckedChange={() => toggleSelect(employee.id)}
							/>
						</Table.Cell>
						<Table.Cell>
							<div class="flex items-center gap-3">
								<Avatar.Root>
									<Avatar.Fallback class="text-xs">{employee.firstName[0]}{employee.lastName[0]}</Avatar.Fallback>
								</Avatar.Root>
								<div>
									<div class="font-medium">
										{employee.firstName}
										{employee.lastName}
									</div>
									{#if employee.user}
										<div class="flex items-center gap-1 text-xs text-muted-foreground">
											<User class="h-3 w-3" />
											Has system access
										</div>
									{/if}
								</div>
							</div>
						</Table.Cell>
						<Table.Cell>
							<div class="text-sm">
								{#if employee.email}
									<div>{employee.email}</div>
								{/if}
								{#if employee.phone}
									<div class="text-muted-foreground">{employee.phone}</div>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell>{employee.department || '-'}</Table.Cell>
						<Table.Cell>{employee.jobTitle || '-'}</Table.Cell>
						<Table.Cell>
							{#if employee.employmentType}
								<EnumBadge enums={data.enums.employment_type} value={employee.employmentType} />
							{:else}
								-
							{/if}
						</Table.Cell>
						<Table.Cell>
							{#if employee.employeeStatus}
								<EnumBadge enums={data.enums.employee_status} value={employee.employeeStatus} />
							{:else}
								-
							{/if}
						</Table.Cell>
						{#if data.canViewSalary}
							<Table.Cell class="text-right">
								{formatCurrency(employee.salary ? Number(employee.salary) : null)}
							</Table.Cell>
						{/if}
						<Table.Cell>
							<div class="flex items-center gap-1 text-sm text-muted-foreground">
								<Briefcase class="h-3 w-3" />
								{employee._count.assignedProjects + employee._count.managedProjects}
							</div>
						</Table.Cell>
						<Table.Cell>
							<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
								<Button variant="ghost" size="icon" href="/employees/{employee.id}">
									<Eye class="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon" href="/employees/{employee.id}/edit">
									<Pencil class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onclick={() =>
										openDeleteDialog({
											id: employee.id,
											firstName: employee.firstName,
											lastName: employee.lastName,
											hasUser: !!employee.user
										})}
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={data.canViewSalary ? 10 : 9} class="text-center py-8">
							<div class="text-muted-foreground">No employees found</div>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>

	<!-- Pagination -->
	{#if data.totalPages > 1}
		<div class="flex items-center justify-between">
			<p class="text-sm text-muted-foreground">
				Showing {(data.page - 1) * data.pageSize + 1} to {Math.min(
					data.page * data.pageSize,
					data.totalCount
				)} of {data.totalCount} employees
			</p>
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={data.page <= 1}
					onclick={() => updateFilter('page', String(data.page - 1))}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={data.page >= data.totalPages}
					onclick={() => updateFilter('page', String(data.page + 1))}
				>
					Next
				</Button>
			</div>
		</div>
	{/if}
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Employee</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete {selectedEmployee?.firstName}
				{selectedEmployee?.lastName}? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		{#if selectedEmployee?.hasUser}
			<div class="flex items-center space-x-2 py-2">
				<Checkbox
					id="deactivateUser"
					checked={deactivateUser}
					onCheckedChange={(checked) => (deactivateUser = checked === true)}
				/>
				<label for="deactivateUser" class="text-sm cursor-pointer">
					Also deactivate the linked user account
				</label>
			</div>
		{/if}
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/delete"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						deleteDialogOpen = false;
						selectedEmployee = null;
					};
				}}
			>
				<input type="hidden" name="id" value={selectedEmployee?.id} />
				<input type="hidden" name="deactivateUser" value={deactivateUser.toString()} />
				<Button type="submit" variant="destructive">Delete</Button>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Bulk Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={bulkDeleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {selectedIds.size} Employees</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete {selectedIds.size} employees? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		{#if selectedWithUsers.length > 0}
			<div class="flex items-center space-x-2 py-2">
				<Checkbox
					id="deactivateUsers"
					checked={deactivateUsers}
					onCheckedChange={(checked) => (deactivateUsers = checked === true)}
				/>
				<label for="deactivateUsers" class="text-sm cursor-pointer">
					Also deactivate {selectedWithUsers.length} linked user account{selectedWithUsers.length > 1 ? 's' : ''}
				</label>
			</div>
		{/if}
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/bulkDelete"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						bulkDeleteDialogOpen = false;
						selectedIds = new Set();
					};
				}}
			>
				<input type="hidden" name="ids" value={Array.from(selectedIds).join(',')} />
				<input type="hidden" name="deactivateUsers" value={deactivateUsers.toString()} />
				<Button type="submit" variant="destructive">Delete {selectedIds.size} Employees</Button>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
