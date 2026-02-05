<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Alert from '$lib/components/ui/alert';
	import {
		ArrowLeft,
		Pencil,
		Calendar,
		DollarSign,
		Building,
		Briefcase,
		RefreshCw,
		AlertTriangle,
		Receipt,
		CheckCircle,
		XCircle
	} from 'lucide-svelte';

	let { data } = $props();

	const statusLabels: Record<string, string> = {
		paid: 'Paid',
		pending: 'Pending',
		late: 'Late',
		suspended: 'Suspended'
	};

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
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" href="/finances/expenses">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div>
				<h1 class="text-3xl font-bold tracking-tight">{data.expense.description}</h1>
				<p class="text-muted-foreground">
					{categoryLabels[data.expense.category] || data.expense.category}
					&bull; {formatDate(data.expense.date)}
				</p>
			</div>
		</div>
		{#if !data.expense.isDeleted}
			<Button href="/finances/expenses/{data.expense.id}/edit">
				<Pencil class="mr-2 h-4 w-4" />
				Edit
			</Button>
		{/if}
	</div>

	{#if data.expense.isDeleted}
		<Alert.Root variant="destructive" class="max-w-4xl">
			<AlertTriangle class="h-4 w-4" />
			<Alert.Title>Deleted Record</Alert.Title>
			<Alert.Description>
				This expense record has been deleted. Only administrators can view this record.
			</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="grid gap-6 md:grid-cols-3">
		<!-- Main Info -->
		<Card.Root class="md:col-span-2">
			<Card.Header>
				<Card.Title>Expense Details</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-6">
				<div class="grid grid-cols-2 gap-6">
					<div>
						<div class="text-sm text-muted-foreground">Amount</div>
						<div class="text-2xl font-bold text-red-600">
							{formatCurrency(Number(data.expense.amount), data.expense.currency)}
						</div>
					</div>
					<div>
						<div class="text-sm text-muted-foreground">Status</div>
						<div class="mt-1">
							<Badge variant={getStatusBadgeVariant(data.expense.status)}>
								{statusLabels[data.expense.status] || data.expense.status}
							</Badge>
						</div>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-6">
					<div>
						<div class="text-sm text-muted-foreground flex items-center gap-2">
							<Calendar class="h-4 w-4" />
							Date
						</div>
						<div>{formatDate(data.expense.date)}</div>
					</div>
					{#if data.expense.dueDate}
						<div>
							<div class="text-sm text-muted-foreground">Due Date</div>
							<div>{formatDate(data.expense.dueDate)}</div>
						</div>
					{/if}
				</div>

				<div class="grid grid-cols-2 gap-6">
					<div>
						<div class="text-sm text-muted-foreground">Tax Deductible</div>
						<div class="flex items-center gap-2 mt-1">
							{#if data.expense.taxDeductible}
								<CheckCircle class="h-4 w-4 text-green-600" />
								<span>Yes</span>
							{:else}
								<XCircle class="h-4 w-4 text-muted-foreground" />
								<span>No</span>
							{/if}
						</div>
					</div>
					{#if data.expense.receiptPath}
						<div>
							<div class="text-sm text-muted-foreground flex items-center gap-2">
								<Receipt class="h-4 w-4" />
								Receipt
							</div>
							<div>
								<Badge variant="outline">Attached</Badge>
							</div>
						</div>
					{/if}
				</div>

				{#if data.expense.isRecurring}
					<div>
						<div class="text-sm text-muted-foreground flex items-center gap-2">
							<RefreshCw class="h-4 w-4" />
							Recurring
						</div>
						<Badge variant="outline">
							{recurringLabels[data.expense.recurringPeriod || ''] || data.expense.recurringPeriod}
						</Badge>
					</div>
				{/if}

				{#if data.expense.notes}
					<div>
						<div class="text-sm text-muted-foreground">Notes</div>
						<div class="whitespace-pre-wrap">{data.expense.notes}</div>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- Side Info -->
		<div class="space-y-6">
			{#if data.expense.vendor}
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-base flex items-center gap-2">
							<Building class="h-4 w-4" />
							Vendor
						</Card.Title>
					</Card.Header>
					<Card.Content>
						<a href="/vendors/{data.expense.vendor.id}" class="font-medium hover:underline">
							{data.expense.vendor.name}
						</a>
						{#if data.expense.vendor.email}
							<div class="text-sm text-muted-foreground">{data.expense.vendor.email}</div>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}

			{#if data.expense.project}
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-base flex items-center gap-2">
							<Briefcase class="h-4 w-4" />
							Project
						</Card.Title>
					</Card.Header>
					<Card.Content>
						<a href="/projects/{data.expense.project.id}" class="font-medium hover:underline">
							{data.expense.project.name}
						</a>
						{#if data.expense.project.client}
							<div class="text-sm text-muted-foreground">
								<a
									href="/clients/{data.expense.project.client.id}"
									class="hover:underline"
								>
									{data.expense.project.client.name}
								</a>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">Record Info</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2 text-sm">
					<div>
						<span class="text-muted-foreground">Created by:</span>
						{data.expense.createdBy.name}
					</div>
					<div>
						<span class="text-muted-foreground">Created:</span>
						{formatDate(data.expense.createdAt)}
					</div>
					<div>
						<span class="text-muted-foreground">Updated:</span>
						{formatDate(data.expense.updatedAt)}
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
