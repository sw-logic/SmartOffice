<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import DateRangeSelector from '$lib/components/shared/DateRangeSelector.svelte';
	import IncomeFormModal from '$lib/components/shared/IncomeFormModal.svelte';
	import {
		Plus,
		Search,
		ArrowUpDown,
		Trash2,
		Pencil,
		RefreshCw,
		TrendingUp
	} from 'lucide-svelte';

	let { data } = $props();

	let searchInput = $state(data.filters.search);
	let deleteDialogOpen = $state(false);
	let selectedIncome = $state<{ id: number; description: string } | null>(null);
	let modalOpen = $state(false);
	let editIncomeId = $state<number | null>(null);

	function openCreateModal() {
		editIncomeId = null;
		modalOpen = true;
	}

	function openEditModal(id: number) {
		editIncomeId = id;
		modalOpen = true;
	}

	const statusOptions = [
		{ value: 'paid', label: 'Paid' },
		{ value: 'pending', label: 'Pending' },
		{ value: 'late', label: 'Late' },
		{ value: 'suspended', label: 'Suspended' }
	];

	const categoryLabels: Record<string, string> = {
		project_payment: 'Project Payment',
		consulting: 'Consulting',
		product_sale: 'Product Sale',
		subscription: 'Subscription',
		commission: 'Commission',
		refund: 'Refund',
		other: 'Other'
	};

	const recurringLabels: Record<string, string> = {
		weekly: 'Weekly',
		monthly: 'Monthly',
		quarterly: 'Quarterly',
		yearly: 'Yearly'
	};

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

	function handleDateRangeChange(start: string, end: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('startDate', start);
		params.set('endDate', end);
		params.delete('page');
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

	function openDeleteDialog(income: { id: number; description: string }) {
		selectedIncome = income;
		deleteDialogOpen = true;
	}

	function getStatusBadgeVariant(
		status: string
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'paid':
				return 'default';
			case 'pending':
				return 'secondary';
			case 'late':
				return 'destructive';
			case 'suspended':
				return 'outline';
			default:
				return 'outline';
		}
	}

	function formatCurrency(amount: number, currency: string = 'USD'): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency
		}).format(amount);
	}

	function formatDate(date: Date | string | null): string {
		if (!date) return '-';
		return new Date(date).toLocaleDateString();
	}

</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Income</h1>
			<p class="text-muted-foreground">Track and manage your income</p>
		</div>
		<Button onclick={openCreateModal}>
			<Plus class="mr-2 h-4 w-4" />
			Add Income
		</Button>
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-4">
		<DateRangeSelector
			startDate={data.filters.startDate}
			endDate={data.filters.endDate}
			onRangeChange={handleDateRangeChange}
		/>

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
			value={data.filters.clientId}
			onValueChange={(v) => updateFilter('clientId', v)}
		>
			<Select.Trigger class="w-40">
				{data.clients.find((c) => String(c.id) === data.filters.clientId)?.name || 'All Clients'}
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">All Clients</Select.Item>
				{#each data.clients as client}
					<Select.Item value={String(client.id)}>{client.name}</Select.Item>
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
					<Table.Head>
						<Button variant="ghost" class="-ml-4" onclick={() => toggleSort('date')}>
							Date
							<ArrowUpDown class="ml-2 h-4 w-4" />
						</Button>
					</Table.Head>
					<Table.Head>Description</Table.Head>
					<Table.Head>Client</Table.Head>
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
				{#each data.incomes as income}
					<Table.Row>
						<Table.Cell>
							<div>
								<div>{formatDate(income.date)}</div>
								{#if income.dueDate}
									<div class="text-xs text-muted-foreground">Due: {formatDate(income.dueDate)}</div>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell>
							<div>
								<div class="font-medium">{income.description}</div>
								{#if income.invoiceReference}
									<div class="text-xs text-muted-foreground">Ref: {income.invoiceReference}</div>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell>
							{#if income.client}
								<a href="/clients/{income.client.id}" class="hover:underline">
									{income.client.name}
								</a>
							{:else}
								<span class="text-muted-foreground">-</span>
							{/if}
						</Table.Cell>
						<Table.Cell>
							<Badge variant="outline">{categoryLabels[income.category] || income.category}</Badge>
						</Table.Cell>
						<Table.Cell>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									<Badge
										variant={getStatusBadgeVariant(income.status)}
										class="cursor-pointer hover:opacity-80"
									>
										{statusOptions.find((s) => s.value === income.status)?.label || income.status}
									</Badge>
								</DropdownMenu.Trigger>
								<DropdownMenu.Content>
									{#each statusOptions as option}
										<form method="POST" action="?/updateStatus" use:enhance>
											<input type="hidden" name="id" value={income.id} />
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
							{#if income.isRecurring}
								<Badge variant="outline">
									<RefreshCw class="mr-1 h-3 w-3" />
									{recurringLabels[income.recurringPeriod || ''] || income.recurringPeriod}
								</Badge>
							{:else}
								<span class="text-muted-foreground">-</span>
							{/if}
						</Table.Cell>
						<Table.Cell class="text-right font-medium text-green-600">
							{formatCurrency(Number(income.amount), income.currency)}
						</Table.Cell>
						<Table.Cell class="text-right">
							{income.tax}%
						</Table.Cell>
						<Table.Cell class="text-right">
							{formatCurrency(income.tax_value, income.currency)}
						</Table.Cell>
						<Table.Cell>
							<div class="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									onclick={() => openEditModal(income.id)}
									title="Edit income"
								>
									<Pencil class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => openDeleteDialog({ id: income.id, description: income.description })}
									title="Delete income"
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={10} class="text-center py-8">
							<div class="text-muted-foreground">No income records found for this period</div>
						</Table.Cell>
					</Table.Row>
				{/each}

				<!-- Summary Row -->
				{#if data.incomes.length > 0}
					<Table.Row class="bg-muted/50 font-medium">
						<Table.Cell colspan={6} class="text-right">
							<div class="flex items-center justify-end gap-2">
								<TrendingUp class="h-4 w-4 text-green-600" />
								Summary ({data.summary.count} records)
							</div>
						</Table.Cell>
						<Table.Cell class="text-right text-green-600">
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

<!-- Income Form Modal -->
<IncomeFormModal
	bind:open={modalOpen}
	incomeId={editIncomeId}
	clients={data.clients}
	projects={data.projects}
	categories={data.incomeCategories}
	currencies={data.currencies}
	statuses={data.incomeStatuses}
	recurringPeriods={data.recurringPeriods}
	onSaved={() => invalidateAll()}
/>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Income</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete "{selectedIncome?.description}"? This action can be undone by
				an administrator.
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
						selectedIncome = null;
					};
				}}
			>
				<input type="hidden" name="id" value={selectedIncome?.id} />
				<Button type="submit" variant="destructive">Delete</Button>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
