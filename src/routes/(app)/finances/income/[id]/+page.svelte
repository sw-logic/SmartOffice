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
		FileText,
		User,
		Briefcase,
		RefreshCw,
		AlertTriangle
	} from 'lucide-svelte';

	let { data } = $props();

	const statusLabels: Record<string, string> = {
		paid: 'Paid',
		pending: 'Pending',
		late: 'Late',
		suspended: 'Suspended'
	};

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

	const taxAmount = data.income.taxRate
		? Number(data.income.amount) * (Number(data.income.taxRate) / 100)
		: 0;
	const netAmount = Number(data.income.amount) - taxAmount;
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" href="/finances/income">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div>
				<h1 class="text-3xl font-bold tracking-tight">{data.income.description}</h1>
				<p class="text-muted-foreground">
					{categoryLabels[data.income.category] || data.income.category}
					&bull; {formatDate(data.income.date)}
				</p>
			</div>
		</div>
		{#if !data.income.isDeleted}
			<Button href="/finances/income/{data.income.id}/edit">
				<Pencil class="mr-2 h-4 w-4" />
				Edit
			</Button>
		{/if}
	</div>

	{#if data.income.isDeleted}
		<Alert.Root variant="destructive" class="max-w-4xl">
			<AlertTriangle class="h-4 w-4" />
			<Alert.Title>Deleted Record</Alert.Title>
			<Alert.Description>
				This income record has been deleted. Only administrators can view this record.
			</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="grid gap-6 md:grid-cols-3">
		<!-- Main Info -->
		<Card.Root class="md:col-span-2">
			<Card.Header>
				<Card.Title>Income Details</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-6">
				<div class="grid grid-cols-2 gap-6">
					<div>
						<div class="text-sm text-muted-foreground">Amount</div>
						<div class="text-2xl font-bold text-green-600">
							{formatCurrency(Number(data.income.amount), data.income.currency)}
						</div>
					</div>
					<div>
						<div class="text-sm text-muted-foreground">Status</div>
						<div class="mt-1">
							<Badge variant={getStatusBadgeVariant(data.income.status)}>
								{statusLabels[data.income.status] || data.income.status}
							</Badge>
						</div>
					</div>
				</div>

				{#if data.income.taxRate}
					<div class="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
						<div>
							<div class="text-sm text-muted-foreground">Gross Amount</div>
							<div class="font-medium">
								{formatCurrency(Number(data.income.amount), data.income.currency)}
							</div>
						</div>
						<div>
							<div class="text-sm text-muted-foreground">Tax ({Number(data.income.taxRate)}%)</div>
							<div class="font-medium">
								{formatCurrency(taxAmount, data.income.currency)}
							</div>
						</div>
						<div>
							<div class="text-sm text-muted-foreground">Net Amount</div>
							<div class="font-medium">
								{formatCurrency(netAmount, data.income.currency)}
							</div>
						</div>
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-6">
					<div>
						<div class="text-sm text-muted-foreground flex items-center gap-2">
							<Calendar class="h-4 w-4" />
							Date
						</div>
						<div>{formatDate(data.income.date)}</div>
					</div>
					{#if data.income.dueDate}
						<div>
							<div class="text-sm text-muted-foreground">Due Date</div>
							<div>{formatDate(data.income.dueDate)}</div>
						</div>
					{/if}
				</div>

				{#if data.income.invoiceReference}
					<div>
						<div class="text-sm text-muted-foreground flex items-center gap-2">
							<FileText class="h-4 w-4" />
							Invoice Reference
						</div>
						<div>{data.income.invoiceReference}</div>
					</div>
				{/if}

				{#if data.income.isRecurring}
					<div>
						<div class="text-sm text-muted-foreground flex items-center gap-2">
							<RefreshCw class="h-4 w-4" />
							Recurring
						</div>
						<Badge variant="outline">
							{recurringLabels[data.income.recurringPeriod || ''] || data.income.recurringPeriod}
						</Badge>
					</div>
				{/if}

				{#if data.income.notes}
					<div>
						<div class="text-sm text-muted-foreground">Notes</div>
						<div class="whitespace-pre-wrap">{data.income.notes}</div>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- Side Info -->
		<div class="space-y-6">
			{#if data.income.client}
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-base flex items-center gap-2">
							<User class="h-4 w-4" />
							Client
						</Card.Title>
					</Card.Header>
					<Card.Content>
						<a href="/clients/{data.income.client.id}" class="font-medium hover:underline">
							{data.income.client.name}
						</a>
						{#if data.income.client.email}
							<div class="text-sm text-muted-foreground">{data.income.client.email}</div>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}

			{#if data.income.project}
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-base flex items-center gap-2">
							<Briefcase class="h-4 w-4" />
							Project
						</Card.Title>
					</Card.Header>
					<Card.Content>
						<a href="/projects/{data.income.project.id}" class="font-medium hover:underline">
							{data.income.project.name}
						</a>
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
						{data.income.createdBy.name}
					</div>
					<div>
						<span class="text-muted-foreground">Created:</span>
						{formatDate(data.income.createdAt)}
					</div>
					<div>
						<span class="text-muted-foreground">Updated:</span>
						{formatDate(data.income.updatedAt)}
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
