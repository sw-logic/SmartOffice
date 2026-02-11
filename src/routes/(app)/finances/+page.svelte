<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Select from '$lib/components/ui/select';
	import {
		TrendingUp,
		TrendingDown,
		DollarSign,
		Users,
		ChevronLeft,
		ChevronRight,
		RefreshCw
	} from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';
	import { createCurrencyFormatter } from '$lib/utils/currency';
	import { groupFinanceRecords, type GroupByField } from '$lib/utils/group-by';
	import GroupHeaderRow from '$lib/components/shared/GroupHeaderRow.svelte';

	let { data } = $props();

	const fmt = createCurrencyFormatter(data.enums.currency);

	const monthNames = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];

	const categoryLabels: Record<string, string> = {
		project_payment: 'Project Payment',
		consulting: 'Consulting',
		product_sale: 'Product Sale',
		subscription: 'Subscription',
		commission: 'Commission',
		refund: 'Refund',
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

	const statusOptions: Record<string, string> = {
		paid: 'Paid',
		pending: 'Pending',
		late: 'Late',
		suspended: 'Suspended'
	};

	const periodLabels: Record<string, string> = {
		q1: 'Q1 (Jan–Mar)',
		q2: 'Q2 (Apr–Jun)',
		q3: 'Q3 (Jul–Sep)',
		q4: 'Q4 (Oct–Dec)',
		year: 'Full Year'
	};

	function getPeriodLabel(period: string): string {
		if (periodLabels[period]) return periodLabels[period];
		const m = parseInt(period);
		if (m >= 1 && m <= 12) return `${monthNames[m - 1]} ${data.year}`;
		return period;
	}

	function navigateTo(year: number, period: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('year', String(year));
		params.set('period', period);
		goto(`?${params.toString()}`);
	}

	function changeYear(delta: number) {
		navigateTo(data.year + delta, data.period);
	}

	function changePeriod(p: string) {
		navigateTo(data.year, p);
	}

	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;

	let balancePositive = $derived(data.summary.balance >= 0);
	let isMultiMonth = $derived(['q1', 'q2', 'q3', 'q4', 'year'].includes(data.period));

	// Group-by
	let groupBy = $derived(($page.url.searchParams.get('groupBy') as GroupByField) || 'none');
	let expandedIncomeGroups = $state<Set<string>>(new Set());
	let expandedExpenseGroups = $state<Set<string>>(new Set());

	function toggleIncomeGroup(key: string) {
		const next = new Set(expandedIncomeGroups);
		if (next.has(key)) { next.delete(key); } else { next.add(key); }
		expandedIncomeGroups = next;
	}

	function toggleExpenseGroup(key: string) {
		const next = new Set(expandedExpenseGroups);
		if (next.has(key)) { next.delete(key); } else { next.add(key); }
		expandedExpenseGroups = next;
	}

	function updateGroupBy(v: string) {
		const params = new URLSearchParams($page.url.searchParams);
		if (v) { params.set('groupBy', v); } else { params.delete('groupBy'); }
		goto(`?${params.toString()}`);
	}

	let groupedIncomes = $derived(
		groupFinanceRecords(
			data.incomes,
			groupBy,
			groupBy === 'category' ? data.enums.income_category : data.enums.income_status
		)
	);

	let groupedExpenses = $derived(
		groupFinanceRecords(
			data.expenses,
			groupBy,
			groupBy === 'category' ? data.enums.expense_category : data.enums.expense_status
		)
	);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Finances Dashboard</h1>
			<p class="text-muted-foreground">Monthly financial overview</p>
		</div>
		<div class="flex items-center gap-4">
			<Select.Root
				type="single"
				value={groupBy}
				onValueChange={(v) => updateGroupBy(v)}
			>
				<Select.Trigger class="w-40">
					{groupBy === 'category' ? 'By Category' : groupBy === 'status' ? 'By Status' : 'No Grouping'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="">No Grouping</Select.Item>
					<Select.Item value="category">By Category</Select.Item>
					<Select.Item value="status">By Status</Select.Item>
				</Select.Content>
			</Select.Root>
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
        <!-- Period Tabs -->
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
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Income</Card.Title>
				<TrendingUp class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold text-green-600">
					{@html fmt.formatHtml(data.summary.totalIncome)}
				</div>
				<p class="text-muted-foreground text-xs">
					{data.summary.incomeCount} records &middot; Tax: {@html fmt.formatHtml(
						data.summary.totalIncomeTax
					)}
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Expenses</Card.Title>
				<TrendingDown class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold text-red-600">
					{@html fmt.formatHtml(data.summary.totalExpenses)}
				</div>
				<p class="text-muted-foreground text-xs">
					{data.summary.expenseCount} records &middot; Tax: {@html fmt.formatHtml(
						data.summary.totalExpensesTax
					)}
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Employee Costs</Card.Title>
				<Users class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold text-orange-600">
					{@html fmt.formatHtml(data.summary.totalEmployeeCost)}
				</div>
				<p class="text-muted-foreground text-xs">
					{data.employees.length} employees &middot; Salary: {@html fmt.formatHtml(
						data.summary.totalSalary
					)}
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">{isMultiMonth ? 'Period' : 'Monthly'} Balance</Card.Title>
				<DollarSign class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold" class:text-green-600={balancePositive} class:text-red-600={!balancePositive}>
					{@html fmt.formatHtml(data.summary.balance)}
				</div>
				<p class="text-muted-foreground text-xs">
					Income - (Expenses + Salaries){#if isMultiMonth} &middot; {periodLabels[data.period]}{/if}
				</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Three tables side by side -->
	<div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
		<!-- Income Table -->
		<div class="min-w-0">
			<h2 class="mb-3 text-xl font-semibold flex items-center gap-2">
				<TrendingUp class="h-5 w-5 text-green-600" />
				Income
			</h2>
			<div class="rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Date</Table.Head>
							<Table.Head>Description</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head class="text-right">Amount</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if groupBy !== 'none'}
							{#each groupedIncomes as group}
								<GroupHeaderRow
									label={group.label}
									color={group.color}
									count={group.subtotals.count}
									subtotalAmount={group.subtotals.amount}
									colspan={4}
									expanded={expandedIncomeGroups.has(group.key)}
									onToggle={() => toggleIncomeGroup(group.key)}
									formatCurrency={fmt.formatHtml}
									colorClass="text-green-600"
								/>
								{#if expandedIncomeGroups.has(group.key)}
									{#each group.items as income}
										<Table.Row>
											<Table.Cell class="whitespace-nowrap text-xs">{formatDate(income.date)}</Table.Cell>
											<Table.Cell>
												<div class="font-medium text-sm truncate max-w-[150px]" title={income.description}>
													{income.description}
												</div>
												<div class="text-xs text-muted-foreground">
													{#if income.client}
														{income.client.name}
													{:else if income.clientName}
														{income.clientName}
													{/if}
													{#if income.isRecurring}
														<RefreshCw class="inline h-3 w-3 ml-1" />
													{/if}
												</div>
											</Table.Cell>
											<Table.Cell>
												<EnumBadge enums={data.enums.income_status} value={income.status} class="text-xs" />
											</Table.Cell>
											<Table.Cell class="text-right font-medium text-green-600 whitespace-nowrap">
												{@html fmt.formatHtml(income.amount, income.currency)}
											</Table.Cell>
										</Table.Row>
									{/each}
								{/if}
							{:else}
								<Table.Row>
									<Table.Cell colspan={4} class="py-8 text-center">
										<div class="text-muted-foreground text-sm">
											No income for {getPeriodLabel(data.period)}
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						{:else}
							{#each data.incomes as income}
								<Table.Row>
									<Table.Cell class="whitespace-nowrap text-xs">{formatDate(income.date)}</Table.Cell>
									<Table.Cell>
										<div class="font-medium text-sm truncate max-w-[150px]" title={income.description}>
											{income.description}
										</div>
										<div class="text-xs text-muted-foreground">
											{#if income.client}
												{income.client.name}
											{:else if income.clientName}
												{income.clientName}
											{/if}
											{#if income.isRecurring}
												<RefreshCw class="inline h-3 w-3 ml-1" />
											{/if}
										</div>
									</Table.Cell>
									<Table.Cell>
										<EnumBadge enums={data.enums.income_status} value={income.status} class="text-xs" />
									</Table.Cell>
									<Table.Cell class="text-right font-medium text-green-600 whitespace-nowrap">
										{@html fmt.formatHtml(income.amount, income.currency)}
									</Table.Cell>
								</Table.Row>
							{:else}
								<Table.Row>
									<Table.Cell colspan={4} class="py-8 text-center">
										<div class="text-muted-foreground text-sm">
											No income for {getPeriodLabel(data.period)}
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						{/if}

						{#if data.incomes.length > 0}
							<Table.Row class="bg-muted/50 font-medium">
								<Table.Cell colspan={3} class="text-right text-sm">
									Total ({data.summary.incomeCount})
								</Table.Cell>
								<Table.Cell class="text-right text-green-600 whitespace-nowrap">
									{@html fmt.formatHtml(data.summary.totalIncome)}
								</Table.Cell>
							</Table.Row>
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
		</div>

		<!-- Expenses Table -->
		<div class="min-w-0">
			<h2 class="mb-3 text-xl font-semibold flex items-center gap-2">
				<TrendingDown class="h-5 w-5 text-red-600" />
				Expenses
			</h2>
			<div class="rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Date</Table.Head>
							<Table.Head>Description</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head class="text-right">Amount</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if groupBy !== 'none'}
							{#each groupedExpenses as group}
								<GroupHeaderRow
									label={group.label}
									color={group.color}
									count={group.subtotals.count}
									subtotalAmount={group.subtotals.amount}
									colspan={4}
									expanded={expandedExpenseGroups.has(group.key)}
									onToggle={() => toggleExpenseGroup(group.key)}
									formatCurrency={fmt.formatHtml}
									colorClass="text-red-600"
								/>
								{#if expandedExpenseGroups.has(group.key)}
									{#each group.items as expense}
										<Table.Row>
											<Table.Cell class="whitespace-nowrap text-xs">{formatDate(expense.date)}</Table.Cell>
											<Table.Cell>
												<div class="font-medium text-sm truncate max-w-[150px]" title={expense.description}>
													{expense.description}
												</div>
												<div class="text-xs text-muted-foreground">
													{#if expense.vendor}
														{expense.vendor.name}
													{:else if expense.vendorName}
														{expense.vendorName}
													{/if}
													{#if expense.isRecurring}
														<RefreshCw class="inline h-3 w-3 ml-1" />
													{/if}
												</div>
											</Table.Cell>
											<Table.Cell>
												<EnumBadge enums={data.enums.expense_status} value={expense.status} class="text-xs" />
											</Table.Cell>
											<Table.Cell class="text-right font-medium text-red-600 whitespace-nowrap">
												{@html fmt.formatHtml(expense.amount, expense.currency)}
											</Table.Cell>
										</Table.Row>
									{/each}
								{/if}
							{:else}
								<Table.Row>
									<Table.Cell colspan={4} class="py-8 text-center">
										<div class="text-muted-foreground text-sm">
											No expenses for {getPeriodLabel(data.period)}
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						{:else}
							{#each data.expenses as expense}
								<Table.Row>
									<Table.Cell class="whitespace-nowrap text-xs">{formatDate(expense.date)}</Table.Cell>
									<Table.Cell>
										<div class="font-medium text-sm truncate max-w-[150px]" title={expense.description}>
											{expense.description}
										</div>
										<div class="text-xs text-muted-foreground">
											{#if expense.vendor}
												{expense.vendor.name}
											{:else if expense.vendorName}
												{expense.vendorName}
											{/if}
											{#if expense.isRecurring}
												<RefreshCw class="inline h-3 w-3 ml-1" />
											{/if}
										</div>
									</Table.Cell>
									<Table.Cell>
										<EnumBadge enums={data.enums.expense_status} value={expense.status} class="text-xs" />
									</Table.Cell>
									<Table.Cell class="text-right font-medium text-red-600 whitespace-nowrap">
										{@html fmt.formatHtml(expense.amount, expense.currency)}
									</Table.Cell>
								</Table.Row>
							{:else}
								<Table.Row>
									<Table.Cell colspan={4} class="py-8 text-center">
										<div class="text-muted-foreground text-sm">
											No expenses for {getPeriodLabel(data.period)}
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						{/if}

						{#if data.expenses.length > 0}
							<Table.Row class="bg-muted/50 font-medium">
								<Table.Cell colspan={3} class="text-right text-sm">
									Total ({data.summary.expenseCount})
								</Table.Cell>
								<Table.Cell class="text-right text-red-600 whitespace-nowrap">
									{@html fmt.formatHtml(data.summary.totalExpenses)}
								</Table.Cell>
							</Table.Row>
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
		</div>

		<!-- Employee Salaries Table -->
		<div class="min-w-0">
			<h2 class="mb-3 text-xl font-semibold flex items-center gap-2">
				<Users class="h-5 w-5 text-orange-600" />
				Salaries
				{#if isMultiMonth}
					<span class="text-xs font-normal text-muted-foreground">(monthly rates)</span>
				{/if}
			</h2>
			<div class="rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Name</Table.Head>
							<Table.Head class="text-right">Salary</Table.Head>
							<Table.Head class="text-right">Tax</Table.Head>
							<Table.Head class="text-right">Bonus</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.employees as emp}
							<Table.Row>
								<Table.Cell>
									<div class="flex items-center gap-2">
										<Avatar.Root class="h-7 w-7">
											{#if emp.image}
												<Avatar.Image src="/api/uploads/{emp.image}" alt="{emp.firstName ?? ''} {emp.lastName ?? ''}" />
											{/if}
											<Avatar.Fallback class="text-xs">{(emp.firstName ?? '')[0]}{(emp.lastName ?? '')[0]}</Avatar.Fallback>
										</Avatar.Root>
										<div class="min-w-0">
											<div class="font-medium text-sm truncate" title="{emp.firstName ?? ''} {emp.lastName ?? ''}">
												{emp.firstName ?? ''} {emp.lastName ?? ''}
											</div>
											{#if emp.jobTitle}
												<div class="text-xs text-muted-foreground truncate" title={emp.jobTitle}>
													{emp.jobTitle}
												</div>
											{/if}
										</div>
									</div>
								</Table.Cell>
								<Table.Cell class="text-right whitespace-nowrap">
									{@html fmt.formatHtml(emp.salary)}
								</Table.Cell>
								<Table.Cell class="text-right whitespace-nowrap">
									{@html fmt.formatHtml(emp.salary_tax)}
								</Table.Cell>
								<Table.Cell class="text-right font-medium text-orange-600 whitespace-nowrap">
									{@html fmt.formatHtml(emp.salary_bonus)}
								</Table.Cell>
							</Table.Row>
						{:else}
							<Table.Row>
								<Table.Cell colspan={4} class="py-8 text-center">
									<div class="text-muted-foreground text-sm">No salaried employees</div>
								</Table.Cell>
							</Table.Row>
						{/each}

						{#if data.employees.length > 0}
							<Table.Row class="bg-muted/50 font-medium">
								<Table.Cell class="text-right text-sm">
									Total ({data.employees.length})
								</Table.Cell>
								<Table.Cell class="text-right whitespace-nowrap">
									{@html fmt.formatHtml(data.summary.totalSalary)}
								</Table.Cell>
								<Table.Cell class="text-right whitespace-nowrap">
									{@html fmt.formatHtml(data.summary.totalSalaryTax)}
								</Table.Cell>
								<Table.Cell class="text-right text-orange-600 whitespace-nowrap">
									{@html fmt.formatHtml(data.summary.totalSalaryBonus)}
								</Table.Cell>
							</Table.Row>
						{/if}
					</Table.Body>
				</Table.Root>
			</div>
		</div>
	</div>
</div>
