<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import MarkdownViewer from '$lib/components/shared/MarkdownViewer.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import {
		ArrowLeft,
		Pencil,
		Trash2,
		Building2,
		Mail,
		Calendar,
		FileText,
		Layers
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	let deleteDialogOpen = $state(false);
	let isDeleting = $state(false);

	function formatCurrency(amount: number, currency: string = 'USD'): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency
		}).format(amount);
	}

	async function handleDelete() {
		isDeleting = true;
		const formData = new FormData();

		const response = await fetch('?/delete', {
			method: 'POST',
			body: formData
		});

		const result = await response.json();

		if (result.type === 'redirect') {
			toast.success('Offer deleted successfully');
			goto('/offers');
		} else if (result.type === 'success') {
			toast.success('Offer deleted successfully');
			goto('/offers');
		} else {
			toast.error(result.data?.error || 'Failed to delete offer');
			isDeleting = false;
			deleteDialogOpen = false;
		}
	}

	// Compute option totals
	function getOptionTotals(items: any[]) {
		let subtotal = 0;
		let discount = 0;
		let tax = 0;
		let total = 0;
		for (const item of items) {
			subtotal += item.subtotal;
			discount += item.discountAmount;
			tax += item.taxAmount;
			total += item.total;
		}
		return { subtotal, discount, tax, total };
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" onclick={() => goto('/offers')}>
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-3xl font-bold tracking-tight">{data.offer.offerNumber}</h1>
					{#if data.offer.title}
						<span class="text-xl text-muted-foreground">&mdash; {data.offer.title}</span>
					{/if}
					<EnumBadge enums={data.enums.offer_status} value={data.offer.status} />
				</div>
				<p class="text-muted-foreground">
					Created {formatDate(data.offer.createdAt)} by {data.offer.createdBy.name}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" onclick={() => goto(`/offers/${data.offer.id}/edit`)}>
				<Pencil class="mr-2 h-4 w-4" />
				Edit
			</Button>
			<Button variant="destructive" onclick={() => (deleteDialogOpen = true)}>
				<Trash2 class="mr-2 h-4 w-4" />
				Delete
			</Button>
		</div>
	</div>

	<!-- Info Cards Row -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<!-- Client Info -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Client</Card.Title>
				<Building2 class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				{#if data.offer.client}
					<a href="/clients/{data.offer.client.id}" class="text-lg font-semibold hover:underline">
						{data.offer.client.name}
					</a>
				{:else if data.offer.clientName}
					<div class="text-lg font-semibold text-muted-foreground">{data.offer.clientName}</div>
				{:else}
					<div class="text-muted-foreground">No client</div>
				{/if}
				{#if data.offer.clientCompanyName}
					<p class="text-sm text-muted-foreground">{data.offer.clientCompanyName}</p>
				{/if}
				{#if data.offer.clientEmail}
					<p class="text-sm text-muted-foreground flex items-center gap-1">
						<Mail class="h-3 w-3" />
						{data.offer.clientEmail}
					</p>
				{/if}
				{#if data.offer.clientAddress}
					<p class="text-sm text-muted-foreground mt-1">{data.offer.clientAddress}</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- Dates -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Dates</Card.Title>
				<Calendar class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="space-y-1">
					<div>
						<span class="text-sm text-muted-foreground">Issue Date:</span>
						<span class="ml-2 font-medium">{formatDate(data.offer.date)}</span>
					</div>
					<div>
						<span class="text-sm text-muted-foreground">Valid Until:</span>
						<span class="ml-2 font-medium">{formatDate(data.offer.validUntil)}</span>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Financial Summary -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Summary</Card.Title>
				<FileText class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="space-y-1">
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Subtotal:</span>
						<span>{formatCurrency(data.offer.subtotal, data.offer.currency)}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Tax:</span>
						<span>{formatCurrency(data.offer.taxTotal, data.offer.currency)}</span>
					</div>
					{#if data.offer.discountType && data.offer.discountValue}
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Discount:</span>
							<span class="text-red-600">
								-{data.offer.discountType === 'percentage'
									? `${data.offer.discountValue}%`
									: formatCurrency(data.offer.discountValue, data.offer.currency)}
							</span>
						</div>
					{/if}
					{#if data.offer.showGrandTotal}
						<div class="flex justify-between border-t pt-1 font-semibold">
							<span>Grand Total:</span>
							<span>{formatCurrency(data.offer.grandTotal, data.offer.currency)}</span>
						</div>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Options Count -->
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Options</Card.Title>
				<Layers class="text-muted-foreground h-4 w-4" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{data.offer.options.length}</div>
				<p class="text-muted-foreground text-xs">
					{data.offer.options.reduce((sum: number, o: any) => sum + o.items.length, 0)} total items
				</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Options with Items -->
	{#each data.offer.options as option, optIndex}
		{@const totals = getOptionTotals(option.items)}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Badge variant="outline">Option {optIndex + 1}</Badge>
					{option.name}
				</Card.Title>
				{#if option.description}
					<p class="text-sm text-muted-foreground">{option.description}</p>
				{/if}
			</Card.Header>
			<Card.Content>
				<div class="rounded-md border">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="w-[40px]">#</Table.Head>
								<Table.Head>Name</Table.Head>
								<Table.Head>SKU</Table.Head>
								<Table.Head class="text-right">Qty</Table.Head>
								<Table.Head>Unit</Table.Head>
								<Table.Head class="text-right">Unit Price</Table.Head>
								<Table.Head class="text-right">Discount %</Table.Head>
								<Table.Head class="text-right">Tax %</Table.Head>
								<Table.Head class="text-right">Total</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each option.items as item, itemIndex}
								<Table.Row>
									<Table.Cell class="text-muted-foreground">{itemIndex + 1}</Table.Cell>
									<Table.Cell>
										<div class="font-medium">{item.name}</div>
										{#if item.description}
											<div class="text-xs text-muted-foreground">{item.description}</div>
										{/if}
									</Table.Cell>
									<Table.Cell class="text-muted-foreground">{item.sku || '-'}</Table.Cell>
									<Table.Cell class="text-right">{item.quantity}</Table.Cell>
									<Table.Cell>{item.unitOfMeasure}</Table.Cell>
									<Table.Cell class="text-right">
										{formatCurrency(item.unitPrice, data.offer.currency)}
									</Table.Cell>
									<Table.Cell class="text-right">
										{item.discount > 0 ? `${item.discount}%` : '-'}
									</Table.Cell>
									<Table.Cell class="text-right">{item.taxRate}%</Table.Cell>
									<Table.Cell class="text-right font-medium">
										{formatCurrency(item.total, data.offer.currency)}
									</Table.Cell>
								</Table.Row>
							{:else}
								<Table.Row>
									<Table.Cell colspan={9} class="py-4 text-center text-muted-foreground">
										No items in this option
									</Table.Cell>
								</Table.Row>
							{/each}
							<!-- Option Totals -->
							{#if option.items.length > 0}
								<Table.Row class="bg-muted/50 font-medium">
									<Table.Cell colspan={5}></Table.Cell>
									<Table.Cell class="text-right text-sm">
										Subtotal: {formatCurrency(totals.subtotal, data.offer.currency)}
									</Table.Cell>
									<Table.Cell class="text-right text-sm">
										{#if totals.discount > 0}
											-{formatCurrency(totals.discount, data.offer.currency)}
										{:else}
											-
										{/if}
									</Table.Cell>
									<Table.Cell class="text-right text-sm">
										{formatCurrency(totals.tax, data.offer.currency)}
									</Table.Cell>
									<Table.Cell class="text-right">
										{formatCurrency(totals.total, data.offer.currency)}
									</Table.Cell>
								</Table.Row>
							{/if}
						</Table.Body>
					</Table.Root>
				</div>
			</Card.Content>
		</Card.Root>
	{/each}

	<!-- Notes & Terms -->
	{#if data.offer.notes || data.offer.terms}
		<div class="grid gap-4 md:grid-cols-2">
			{#if data.offer.notes}
				<Card.Root>
					<Card.Header>
						<Card.Title>Notes</Card.Title>
					</Card.Header>
					<Card.Content>
						<MarkdownViewer value={data.offer.notes} />
					</Card.Content>
				</Card.Root>
			{/if}
			{#if data.offer.terms}
				<Card.Root>
					<Card.Header>
						<Card.Title>Terms & Conditions</Card.Title>
					</Card.Header>
					<Card.Content>
						<MarkdownViewer value={data.offer.terms} />
					</Card.Content>
				</Card.Root>
			{/if}
		</div>
	{/if}
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Offer</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete offer "{data.offer.offerNumber}"? This will also delete all
				options and items. This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<Button variant="destructive" onclick={handleDelete} disabled={isDeleting}>
				{isDeleting ? 'Deleting...' : 'Delete'}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
