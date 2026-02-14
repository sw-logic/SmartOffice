<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import NotesList from '$lib/components/shared/NotesList.svelte';
	import MarkdownViewer from '$lib/components/shared/MarkdownViewer.svelte';
	import ServiceTimeRecordsList from '$lib/components/shared/ServiceTimeRecordsList.svelte';
	import { toast } from 'svelte-sonner';
	import { createCurrencyFormatter } from '$lib/utils/currency';
	import {
		ArrowLeft,
		Pencil,
		Trash2,
		Building2,
		User,
		Calendar,
		DollarSign,
		Clock,
		Mail,
		Phone,
		Smartphone,
		Link
	} from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	const fmt = createCurrencyFormatter(data.enums.currency);

	let deleteDialogOpen = $state(false);
	let isDeleting = $state(false);

	let timeRecords = $state(data.service.timeRecords);

	function fmtMin(m: number): string {
		const h = Math.floor(m / 60);
		const min = m % 60;
		if (h === 0) return `${min}m`;
		if (min === 0) return `${h}h`;
		return `${h}h ${min}m`;
	}

	let budgetPercent = $derived(
		data.service.budgetedHours
			? Math.min(100, Math.round((data.monthlySpentMinutes / data.service.budgetedHours) * 100))
			: 0
	);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" href="/services">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-3xl font-bold tracking-tight">{data.service.name}</h1>
					<EnumBadge enums={data.enums.service_status} value={data.service.status} />
				</div>
				{#if data.service.client}
					<p class="text-muted-foreground">{data.service.client.name}</p>
				{:else if data.service.clientName}
					<p class="text-muted-foreground">{data.service.clientName}</p>
				{/if}
			</div>
		</div>
		<div class="flex items-center gap-2">
			{#if data.canUpdate}
				<Button variant="outline" href="/services/{data.service.id}/edit">
					<Pencil class="mr-1 h-4 w-4" />
					Edit
				</Button>
			{/if}
			{#if data.canDelete}
				<Button variant="destructive" onclick={() => (deleteDialogOpen = true)}>
					<Trash2 class="mr-1 h-4 w-4" />
					Delete
				</Button>
			{/if}
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Sidebar info -->
		<div class="space-y-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>Service Details</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-3 text-sm">
					{#if data.service.client}
						<div class="flex items-start gap-2">
							<Building2 class="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p class="text-muted-foreground">Client</p>
								<a href="/clients/{data.service.client.id}" class="text-primary hover:underline font-medium">
									{data.service.client.name}
								</a>
							</div>
						</div>
					{/if}

					{#if data.service.assignedTo}
						<div class="flex items-start gap-2">
							<User class="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p class="text-muted-foreground">Assigned To</p>
								<p class="font-medium">{data.service.assignedTo.firstName ?? ''} {data.service.assignedTo.lastName ?? ''}</p>
							</div>
						</div>
					{/if}

					{#if data.service.type}
						{@const typeEnum = data.enums.service_type?.find((e) => e.value === data.service.type)}
						<div class="flex items-start gap-2">
							<Clock class="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p class="text-muted-foreground">Type</p>
								<p class="font-medium">{typeEnum?.label ?? data.service.type}</p>
							</div>
						</div>
					{/if}

					{#if data.service.monthlyFee != null}
						{@const periodLabel = data.enums.recurring_period?.find((p) => p.value === data.service.recurringPeriod)?.label ?? 'Monthly'}
						<div class="flex items-start gap-2">
							<DollarSign class="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p class="text-muted-foreground">{periodLabel} Fee</p>
								<p class="font-medium">
									{fmt.format(data.service.monthlyFee, data.service.currency)}
									{#if data.service.taxRate}
										<span class="text-muted-foreground text-xs ml-1">+ {data.service.taxRate}% tax</span>
									{/if}
								</p>
							</div>
						</div>
					{/if}

					{#if data.service.budgetedHours != null}
						<div class="flex items-start gap-2">
							<Clock class="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p class="text-muted-foreground">Budgeted Hours</p>
								<p class="font-medium">{fmtMin(data.service.budgetedHours)} / month</p>
							</div>
						</div>
					{/if}

					<div class="flex items-start gap-2">
						<Calendar class="h-4 w-4 text-muted-foreground mt-0.5" />
						<div>
							<p class="text-muted-foreground">Start Date</p>
							<p class="font-medium">{formatDate(data.service.startDate)}</p>
						</div>
					</div>

					{#if data.service.endDate}
						<div class="flex items-start gap-2">
							<Calendar class="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p class="text-muted-foreground">End Date</p>
								<p class="font-medium">{formatDate(data.service.endDate)}</p>
							</div>
						</div>
					{/if}

					{#if data.service.incomeId}
						<div class="flex items-start gap-2">
							<Link class="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p class="text-muted-foreground">Linked Income</p>
								<a href="/finances/income/{data.service.incomeId}" class="text-primary hover:underline font-medium">
									View recurring income
								</a>
							</div>
						</div>
					{/if}

					<div class="pt-3 border-t text-muted-foreground">
						Created {formatDate(data.service.createdAt)} by {data.service.createdBy.name}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Contact card -->
			{#if data.service.contact}
				<Card.Root>
					<Card.Header>
						<Card.Title>Contact</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-2 text-sm">
						<p class="font-medium">{data.service.contact.firstName} {data.service.contact.lastName}</p>
						{#if data.service.contact.position}
							<p class="text-muted-foreground">{data.service.contact.position}</p>
						{/if}
						{#if data.service.contact.email}
							<p class="flex items-center gap-1.5">
								<Mail class="h-3.5 w-3.5 text-muted-foreground" />
								<a href="mailto:{data.service.contact.email}" class="text-primary hover:underline">{data.service.contact.email}</a>
							</p>
						{/if}
						{#if data.service.contact.phone}
							<p class="flex items-center gap-1.5">
								<Phone class="h-3.5 w-3.5 text-muted-foreground" />
								{data.service.contact.phone}
							</p>
						{/if}
						{#if data.service.contact.mobile}
							<p class="flex items-center gap-1.5">
								<Smartphone class="h-3.5 w-3.5 text-muted-foreground" />
								{data.service.contact.mobile}
							</p>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}
		</div>

		<!-- Main content with tabs -->
		<div class="lg:col-span-2">
			<Tabs.Root value="overview">
				<Tabs.List>
					<Tabs.Trigger value="overview">Overview</Tabs.Trigger>
					<Tabs.Trigger value="time-records">
						Time Records ({timeRecords.length})
					</Tabs.Trigger>
					<Tabs.Trigger value="notes">Notes</Tabs.Trigger>
				</Tabs.List>

				<!-- Overview Tab -->
				<Tabs.Content value="overview" class="mt-4 space-y-6">
					{#if data.service.budgetedHours}
						<Card.Root>
							<Card.Header>
								<Card.Title>Monthly Budget</Card.Title>
							</Card.Header>
							<Card.Content>
								<div class="space-y-2">
									<div class="flex justify-between text-sm">
										<span>Spent this month: <strong>{fmtMin(data.monthlySpentMinutes)}</strong></span>
										<span>Budget: <strong>{fmtMin(data.service.budgetedHours)}</strong></span>
									</div>
									<div class="w-full bg-muted rounded-full h-3">
										<div
											class="h-3 rounded-full transition-all {budgetPercent >= 90 ? 'bg-red-500' : budgetPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'}"
											style="width: {budgetPercent}%"
										></div>
									</div>
									<p class="text-xs text-muted-foreground text-right">{budgetPercent}% used</p>
								</div>
							</Card.Content>
						</Card.Root>
					{/if}

					{#if data.service.description}
						<Card.Root>
							<Card.Header>
								<Card.Title>Description / SLA</Card.Title>
							</Card.Header>
							<Card.Content>
								<MarkdownViewer value={data.service.description} />
							</Card.Content>
						</Card.Root>
					{/if}

					{#if !data.service.budgetedHours && !data.service.description}
						<p class="text-center text-muted-foreground py-8">No description or budget configured.</p>
					{/if}
				</Tabs.Content>

				<!-- Time Records Tab -->
				<Tabs.Content value="time-records" class="mt-4">
					<ServiceTimeRecordsList
						serviceId={data.service.id}
						{timeRecords}
						typeOptions={data.enums.time_record_type || []}
						categoryOptions={data.enums.time_record_category || []}
						employees={data.employees}
						currentUserId={data.user?.id ?? null}
						onTimeRecordsChange={(records) => { timeRecords = records as typeof timeRecords; }}
					/>
				</Tabs.Content>

				<!-- Notes Tab -->
				<Tabs.Content value="notes" class="mt-4">
					<NotesList
						entityType="Service"
						entityId={String(data.service.id)}
						notePriorities={data.enums.note_priority}
					/>
				</Tabs.Content>
			</Tabs.Root>
		</div>
	</div>
</div>

<!-- Delete confirmation -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Service</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to permanently delete "{data.service.name}"?
				{#if data.service.incomeId}This will also delete the linked recurring income records.{/if}
				This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/delete"
				use:enhance={() => {
					isDeleting = true;
					return async ({ result }) => {
						isDeleting = false;
						if (result.type === 'success') {
							toast.success('Service deleted');
							goto('/services');
						} else {
							toast.error('Failed to delete service');
						}
					};
				}}
			>
				<input type="hidden" name="id" value={data.service.id} />
				<Button type="submit" variant="destructive" disabled={isDeleting}>
					{isDeleting ? 'Deleting...' : 'Delete'}
				</Button>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
