<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { saveListState, restoreListState } from '$lib/utils/list-state';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Select from '$lib/components/ui/select';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import ExpenseFormModal from '$lib/components/shared/ExpenseFormModal.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import {
		Plus,
		Search,
		ArrowUpDown,
		Trash2,
		Pencil,
		RefreshCw,
		TrendingDown,
		Receipt,
		ChevronLeft,
		ChevronRight,
		DollarSign,
		Hash,
		Calculator
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	// Persist/restore list view state
	const LIST_ROUTE = '/finances/expenses';
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
	let selectedExpense = $state<{ id: number; description: string } | null>(null);
	let modalOpen = $state(false);
	let editExpenseId = $state<number | null>(null);
	let editIsProjectedOccurrence = $state(false);

	// Bulk selection
	let selectedIds = $state<Set<number>>(new Set());
	let bulkDeleteDialogOpen = $state(false);
	let isBulkDeleting = $state(false);

	let allSelected = $derived(data.expenses.length > 0 && selectedIds.size === data.expenses.length);
	let someSelected = $derived(selectedIds.size > 0 && selectedIds.size < data.expenses.length);

	function toggleSelectAll() {
		if (allSelected) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(data.expenses.map((e) => e.id));
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
			toast.success(`${selectedIds.size} expense record(s) deleted successfully`);
			selectedIds = new Set();
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete expense records');
		}

		isBulkDeleting = false;
		bulkDeleteDialogOpen = false;
	}

	// Edit choice dialog for projected occurrences
	let editChoiceDialogOpen = $state(false);
	let editChoiceItem = $state<{ id: number; parentId: number | null } | null>(null);

	function openCreateModal() {
		editExpenseId = null;
		editIsProjectedOccurrence = false;
		modalOpen = true;
	}

	function openEditModal(id: number) {
		const expense = data.expenses.find((e) => e.id === id);
		if (expense?.parentId && expense.status === 'projected') {
			// Projected occurrence — ask user what to edit
			editChoiceItem = { id: expense.id, parentId: expense.parentId };
			editChoiceDialogOpen = true;
		} else {
			editExpenseId = id;
			editIsProjectedOccurrence = false;
			modalOpen = true;
		}
	}

	function editOccurrence() {
		if (editChoiceItem) {
			editExpenseId = editChoiceItem.id;
			editIsProjectedOccurrence = true;
			editChoiceDialogOpen = false;
			modalOpen = true;
		}
	}

	function editOriginal() {
		if (editChoiceItem) {
			editExpenseId = editChoiceItem.parentId;
			editIsProjectedOccurrence = false;
			editChoiceDialogOpen = false;
			modalOpen = true;
		}
	}

	const statusOptions = [
		{ value: 'projected', label: 'Projected' },
		{ value: 'paid', label: 'Paid' },
		{ value: 'pending', label: 'Pending' },
		{ value: 'late', label: 'Late' },
		{ value: 'suspended', label: 'Suspended' }
	];

	const categoryLabels: Record<string, string> = {
		salary: 'Salary',
		software: 'Software',
		office: 'Office',
		marketing: 'Marketing',
		travel: 'Travel',
		equipment: 'Equipment',
		contractor: 'Contractor',
		utilities: 'Utilities',
		rent: 'Rent',
		insurance: 'Insurance',
		taxes: 'Taxes',
		other: 'Other'
	};

	const recurringLabels: Record<string, string> = {
		weekly: 'Weekly',
		monthly: 'Monthly',
		quarterly: 'Quarterly',
		yearly: 'Yearly'
	};

	const monthNames = [
		'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
		'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
	];

	const monthFullNames = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];

	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;

	let isMonthPeriod = $derived(parseInt(data.period) >= 1 && parseInt(data.period) <= 12);

	function navigateTo(year: number, period: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('year', String(year));
		params.set('period', period);
		params.delete('page');
		goto(`?${params.toString()}`);
	}

	function changeYear(delta: number) {
		navigateTo(data.year + delta, data.period);
	}

	function changePeriod(p: string) {
		navigateTo(data.year, p);
	}

	function updateFilter(key: string, value: string) {
		const params = new URLSearchParams($page.url.searchParams);
		if (value) {
			params.set(key, value);
		} else {
			params.delete(key);
		}
		if (key !== 'page') {
			params.delete('page');
		}
		goto(`?${params.toString()}`);
	}

	function handleSearch() {
		updateFilter('search', searchInput);
	}

	function toggleSort(column: string) {
		const params = new URLSearchParams($page.url.searchParams);
		const currentSort = params.get('sortBy');
		const currentOrder = params.get('sortOrder') || 'desc';

		if (currentSort === column) {
			params.set('sortOrder', currentOrder === 'asc' ? 'desc' : 'asc');
		} else {
			params.set('sortBy', column);
			params.set('sortOrder', 'desc');
		}
		params.delete('page');
		goto(`?${params.toString()}`);
	}

	function openDeleteDialog(expense: { id: number; description: string }) {
		selectedExpense = expense;
		deleteDialogOpen = true;
	}

	function formatCurrency(amount: number, currency: string = 'USD'): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency
		}).format(amount);
	}

	let average = $derived(data.summary.count > 0 ? data.summary.totalAmount / data.summary.count : 0);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Expenses</h1>
			<p class="text-muted-foreground">Track and manage your expenses</p>
		</div>
		<div class="flex items-center gap-4">
			{#if selectedIds.size > 0}
				<Button variant="destructive" onclick={() => (bulkDeleteDialogOpen = true)}>
					<Trash2 class="mr-2 h-4 w-4" />
					Delete ({selectedIds.size})
				</Button>
			{/if}
            <Button onclick={openCreateModal}>
                <Plus class="mr-2 h-4 w-4" />
                Add Expense
            </Button>
			<div class="flex items-center gap-2">
				<Button variant="outline" size="icon" onclick={() => changeYear(-1)}>
					<ChevronLeft class="h-4 w-4" />
				</Button>
				<span class="min-w-[4rem] text-center text-lg font-semibold">{data.year}</span>
				<Button variant="outline" size="icon" onclick={() => changeYear(1)}>
					<ChevronRight class="h-4 w-4" />
				</Button>
			</div>
		</div>
	</div>

	<!-- Time period selectors -->
	<div class="w-full flex items-center gap-2">
		<Tabs.Root class="flex-12" value={data.period} onValueChange={(v) => changePeriod(v)}>
			<Tabs.List class="w-full gap-2">
				{#each monthNames as name, i}
					{@const m = i + 1}
					{@const isCurrentMonth = data.year === currentYear && String(m) === String(currentMonth)}
					<Tabs.Trigger
						value={String(m)}
						class="rounded-sm {isCurrentMonth ? 'ring-primary/50 ring-2' : ''}"
					>
						{name}
					</Tabs.Trigger>
				{/each}
			</Tabs.List>
		</Tabs.Root>

		<Tabs.Root class="flex-5" value={data.period} onValueChange={(v) => changePeriod(v)}>
			<Tabs.List class="w-full gap-2">
				<Tabs.Trigger value="q1" class="rounded-sm">Q1</Tabs.Trigger>
				<Tabs.Trigger value="q2" class="rounded-sm">Q2</Tabs.Trigger>
				<Tabs.Trigger value="q3" class="rounded-sm">Q3</Tabs.Trigger>
				<Tabs.Trigger value="q4" class="rounded-sm">Q4</Tabs.Trigger>
				<Tabs.Trigger value="year" class="rounded-sm">Year</Tabs.Trigger>
			</Tabs.List>
		</Tabs.Root>
	</div>

	<!-- Summary Cards -->
	<div class="grid gap-4 md:grid-cols-2 {isMonthPeriod ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}">
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Expenses</Card.Title>
				<TrendingDown class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold text-red-600">
					{formatCurrency(data.summary.totalAmount)}
				</div>
				<p class="text-muted-foreground text-xs">
					For selected period
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Tax Value</Card.Title>
				<DollarSign class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">
					{formatCurrency(data.summary.totalTaxValue)}
				</div>
				<p class="text-muted-foreground text-xs">
					Total tax on expenses
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Records</Card.Title>
				<Hash class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">
					{data.summary.count}
				</div>
				<p class="text-muted-foreground text-xs">
					Expense entries
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Average</Card.Title>
				<Calculator class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">
					{formatCurrency(average)}
				</div>
				<p class="text-muted-foreground text-xs">
					Per record
				</p>
			</Card.Content>
		</Card.Root>

		{#if isMonthPeriod && data.cumulativeBalance}
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">YTD Balance (Jan – {monthFullNames[parseInt(data.period) - 1]})</Card.Title>
					<DollarSign class="text-muted-foreground h-4 w-4" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold" class:text-green-600={data.cumulativeBalance.balance >= 0} class:text-red-600={data.cumulativeBalance.balance < 0}>
						{formatCurrency(data.cumulativeBalance.balance)}
					</div>
					<p class="text-muted-foreground text-xs">
						Income: {formatCurrency(data.cumulativeBalance.income)} &middot; Expenses: {formatCurrency(data.cumulativeBalance.expenses)}
					</p>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-4">
		<div class="flex items-center gap-2">
			<Input
				type="search"
				placeholder="Search..."
				class="w-48"
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
			<Select.Trigger class="w-32">
				{statusOptions.find((o) => o.value === data.filters.status)?.label || 'All Status'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All Status</Select.Item>
				{#each statusOptions as option}
					<Select.Item value={option.value}>{option.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Select.Root
			type="single"
			value={data.filters.category}
			onValueChange={(v) => updateFilter('category', v)}
		>
			<Select.Trigger class="w-40">
				{categoryLabels[data.filters.category] || 'All Categories'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All Categories</Select.Item>
				{#each data.categories as cat}
					<Select.Item value={cat}>{categoryLabels[cat] || cat}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Select.Root
			type="single"
			value={data.filters.vendorId}
			onValueChange={(v) => updateFilter('vendorId', v)}
		>
			<Select.Trigger class="w-40">
				{data.vendors.find((v) => String(v.id) === data.filters.vendorId)?.name || 'All Vendors'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All Vendors</Select.Item>
				{#each data.vendors as vendor}
					<Select.Item value={String(vendor.id)}>{vendor.name}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Select.Root
			type="single"
			value={data.filters.isRecurring}
			onValueChange={(v) => updateFilter('isRecurring', v)}
		>
			<Select.Trigger class="w-32">
				{data.filters.isRecurring === 'true'
					? 'Recurring'
					: data.filters.isRecurring === 'false'
						? 'One-time'
						: 'All Types'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All Types</Select.Item>
				<Select.Item value="false">One-time</Select.Item>
				<Select.Item value="true">Recurring</Select.Item>
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
							indeterminate={someSelected}
							onCheckedChange={toggleSelectAll}
						/>
					</Table.Head>
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => toggleSort('date')}>
							Date
							<ArrowUpDown class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>Description</Table.Head>
					<Table.Head>Vendor</Table.Head>
					<Table.Head>Category</Table.Head>
					<Table.Head>Status</Table.Head>
					<Table.Head>Recurring</Table.Head>
					<Table.Head class="text-right">
						<Button variant="ghost" class="-mr-4" onclick={() => toggleSort('amount')}>
							Amount
							<ArrowUpDown class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head class="text-right">Tax %</Table.Head>
					<Table.Head class="text-right">Tax Value</Table.Head>
					<Table.Head class="w-[80px]">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.expenses as expense}
					<Table.Row class={expense.status === 'projected' ? 'opacity-60 border-dashed' : ''}>
						<Table.Cell>
							<Checkbox
								checked={selectedIds.has(expense.id)}
								onCheckedChange={() => toggleSelect(expense.id)}
							/>
						</Table.Cell>
						<Table.Cell>
							<div>
								<div>{formatDate(expense.date)}</div>
								{#if expense.dueDate}
									<div class="text-xs text-muted-foreground">Due: {formatDate(expense.dueDate)}</div>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell>
							<div>
								<div class="font-medium">{expense.description}</div>
								{#if expense.receiptPath}
									<Badge variant="outline" class="mt-1">
										<Receipt class="mr-1 h-3 w-3" />
										Receipt
									</Badge>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell>
							{#if expense.vendor}
								<a href="/vendors/{expense.vendor.id}" class="hover:underline">
									{expense.vendor.name}
								</a>
							{:else if expense.vendorName}
								<span class="text-muted-foreground">{expense.vendorName}</span>
							{:else}
								<span class="text-muted-foreground">-</span>
							{/if}
						</Table.Cell>
						<Table.Cell>
							<Badge variant="outline">{categoryLabels[expense.category] || expense.category}</Badge>
						</Table.Cell>
						<Table.Cell>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									<EnumBadge enums={data.enums.expense_status} value={expense.status} class="cursor-pointer hover:opacity-80" />
								</DropdownMenu.Trigger>
								<DropdownMenu.Content>
									{#each statusOptions as option}
										<form method="POST" action="?/updateStatus" use:enhance>
											<input type="hidden" name="id" value={expense.id} />
											<input type="hidden" name="status" value={option.value} />
											<DropdownMenu.Item class="cursor-pointer">
												<button type="submit" class="w-full text-left">
													{option.label}
												</button>
											</DropdownMenu.Item>
										</form>
									{/each}
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</Table.Cell>
						<Table.Cell>
							{#if expense.isRecurring}
								<Badge variant="outline">
									<RefreshCw class="mr-1 h-3 w-3" />
									{recurringLabels[expense.recurringPeriod || ''] || expense.recurringPeriod}
								</Badge>
							{:else}
								<span class="text-muted-foreground">-</span>
							{/if}
						</Table.Cell>
						<Table.Cell class="text-right font-medium text-red-600">
							{formatCurrency(Number(expense.amount), expense.currency)}
						</Table.Cell>
						<Table.Cell class="text-right">
							{expense.tax}%
						</Table.Cell>
						<Table.Cell class="text-right">
							{formatCurrency(expense.tax_value, expense.currency)}
						</Table.Cell>
						<Table.Cell>
							<div class="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									onclick={() => openEditModal(expense.id)}
									title="Edit expense"
								>
									<Pencil class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => openDeleteDialog({ id: expense.id, description: expense.description })}
									title="Delete expense"
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={11} class="text-center py-8">
							<div class="text-muted-foreground">No expense records found for this period</div>
						</Table.Cell>
					</Table.Row>
				{/each}

				<!-- Summary Row -->
				{#if data.expenses.length > 0}
					<Table.Row class="bg-muted/50 font-medium">
						<Table.Cell colspan={7} class="text-right">
							<div class="flex items-center justify-end gap-2">
								<TrendingDown class="h-4 w-4 text-red-600" />
								Summary ({data.summary.count} records)
							</div>
						</Table.Cell>
						<Table.Cell class="text-right text-red-600">
							{formatCurrency(data.summary.totalAmount)}
						</Table.Cell>
						<Table.Cell class="text-right">-</Table.Cell>
						<Table.Cell class="text-right">
							{formatCurrency(data.summary.totalTaxValue)}
						</Table.Cell>
						<Table.Cell></Table.Cell>
					</Table.Row>
				{/if}
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
				)} of {data.totalCount} records
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

<!-- Expense Form Modal -->
<ExpenseFormModal
	bind:open={modalOpen}
	expenseId={editExpenseId}
	isProjectedOccurrence={editIsProjectedOccurrence}
	vendors={data.vendors}
	projects={data.projects}
	categories={data.enums.expense_category}
	currencies={data.enums.currency}
	statuses={data.enums.expense_status}
	recurringPeriods={data.enums.recurring_period}
	paymentTerms={data.enums.payment_terms}
	onSaved={() => invalidateAll()}
/>

<!-- Edit Choice Dialog for Projected Occurrences -->
<AlertDialog.Root bind:open={editChoiceDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Edit Recurring Expense</AlertDialog.Title>
			<AlertDialog.Description>
				This is a projected occurrence from a recurring expense. What would you like to edit?
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<Button variant="outline" onclick={editOccurrence}>This Occurrence</Button>
			<Button onclick={editOriginal}>Original Record</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Bulk Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={bulkDeleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {selectedIds.size} Expense Record{selectedIds.size !== 1 ? 's' : ''}</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete {selectedIds.size} selected expense record{selectedIds.size !== 1 ? 's' : ''}? This action can be undone by an administrator.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				onclick={handleBulkDelete}
				disabled={isBulkDeleting}
			>
				{isBulkDeleting ? 'Deleting...' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Expense</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete "{selectedExpense?.description}"? This action can be undone
				by an administrator.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/delete"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						deleteDialogOpen = false;
						selectedExpense = null;
					};
				}}
			>
				<input type="hidden" name="id" value={selectedExpense?.id} />
				<Button type="submit" variant="destructive">Delete</Button>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
