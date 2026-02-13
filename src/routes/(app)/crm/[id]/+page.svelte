<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import NotesList from '$lib/components/shared/NotesList.svelte';
	import MarkdownViewer from '$lib/components/shared/MarkdownViewer.svelte';
	import { toast } from 'svelte-sonner';
	import { STAGE_MAP } from '$lib/config/lead-stages';
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
		Smartphone
	} from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	let deleteDialogOpen = $state(false);
	let isDeleting = $state(false);

	const stage = $derived(STAGE_MAP.get(data.lead.stage));

	function formatDuration(minutes: number): string {
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		if (h === 0) return `${m}m`;
		if (m === 0) return `${h}h`;
		return `${h}h ${m}m`;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" href="/crm">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-3xl font-bold tracking-tight">{data.lead.title}</h1>
					{#if stage}
						<Badge style="background-color: {stage.color}; color: white">{stage.label}</Badge>
					{/if}
				</div>
				{#if data.lead.client}
					<p class="text-muted-foreground">{data.lead.client.name}</p>
				{:else if data.lead.clientName}
					<p class="text-muted-foreground">{data.lead.clientName}</p>
				{/if}
			</div>
		</div>
		<div class="flex items-center gap-2">
			{#if data.canUpdate}
				<Button variant="outline" href="/crm/{data.lead.id}/edit">
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
		<!-- Main info -->
		<div class="lg:col-span-2 space-y-6">
			<!-- Details card -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Lead Details</Card.Title>
				</Card.Header>
				<Card.Content>
					<dl class="grid grid-cols-2 gap-4 text-sm">
						{#if data.lead.client}
							<div>
								<dt class="text-muted-foreground flex items-center gap-1"><Building2 class="h-3.5 w-3.5" /> Client</dt>
								<dd class="font-medium mt-0.5">
									<a href="/clients/{data.lead.client.id}" class="text-primary hover:underline">{data.lead.client.name}</a>
								</dd>
							</div>
						{/if}
						{#if data.lead.assignedTo}
							<div>
								<dt class="text-muted-foreground flex items-center gap-1"><User class="h-3.5 w-3.5" /> Assigned To</dt>
								<dd class="font-medium mt-0.5">{data.lead.assignedTo.firstName ?? ''} {data.lead.assignedTo.lastName ?? ''}</dd>
							</div>
						{/if}
						{#if data.lead.budget != null}
							<div>
								<dt class="text-muted-foreground flex items-center gap-1"><DollarSign class="h-3.5 w-3.5" /> Budget</dt>
								<dd class="font-medium mt-0.5">{data.lead.budget.toLocaleString()} {data.lead.currency || ''}</dd>
							</div>
						{/if}
						{#if data.lead.estimatedHours}
							<div>
								<dt class="text-muted-foreground flex items-center gap-1"><Clock class="h-3.5 w-3.5" /> Estimated Time</dt>
								<dd class="font-medium mt-0.5">{formatDuration(data.lead.estimatedHours)}</dd>
							</div>
						{/if}
						{#if data.lead.offerDueDate}
							<div>
								<dt class="text-muted-foreground flex items-center gap-1"><Calendar class="h-3.5 w-3.5" /> Offer Due Date</dt>
								<dd class="font-medium mt-0.5">{formatDate(data.lead.offerDueDate)}</dd>
							</div>
						{/if}
						{#if data.lead.deadline}
							<div>
								<dt class="text-muted-foreground flex items-center gap-1"><Calendar class="h-3.5 w-3.5" /> Deadline</dt>
								<dd class="font-medium mt-0.5">{formatDate(data.lead.deadline)}</dd>
							</div>
						{/if}
						{#if data.lead.source}
							<div>
								<dt class="text-muted-foreground">Source</dt>
								<dd class="font-medium mt-0.5 capitalize">{data.lead.source.replace(/_/g, ' ')}</dd>
							</div>
						{/if}
						<div>
							<dt class="text-muted-foreground">Created By</dt>
							<dd class="font-medium mt-0.5">{data.lead.createdBy.name}</dd>
						</div>
						<div>
							<dt class="text-muted-foreground">Created</dt>
							<dd class="font-medium mt-0.5">{formatDate(data.lead.createdAt)}</dd>
						</div>
					</dl>
				</Card.Content>
			</Card.Root>

			<!-- Description -->
			{#if data.lead.description}
				<Card.Root>
					<Card.Header>
						<Card.Title>Description</Card.Title>
					</Card.Header>
					<Card.Content>
						<MarkdownViewer value={data.lead.description} />
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Notes -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Notes</Card.Title>
				</Card.Header>
				<Card.Content>
					<NotesList
						entityType="Lead"
						entityId={String(data.lead.id)}
						notePriorities={data.enums.note_priority}
					/>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Sidebar -->
		<div class="space-y-6">
			<!-- Contact card -->
			{#if data.lead.contact}
				<Card.Root>
					<Card.Header>
						<Card.Title>Contact</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-2 text-sm">
						<p class="font-medium">{data.lead.contact.firstName} {data.lead.contact.lastName}</p>
						{#if data.lead.contact.position}
							<p class="text-muted-foreground">{data.lead.contact.position}</p>
						{/if}
						{#if data.lead.contact.email}
							<p class="flex items-center gap-1.5">
								<Mail class="h-3.5 w-3.5 text-muted-foreground" />
								<a href="mailto:{data.lead.contact.email}" class="text-primary hover:underline">{data.lead.contact.email}</a>
							</p>
						{/if}
						{#if data.lead.contact.phone}
							<p class="flex items-center gap-1.5">
								<Phone class="h-3.5 w-3.5 text-muted-foreground" />
								{data.lead.contact.phone}
							</p>
						{/if}
						{#if data.lead.contact.mobile}
							<p class="flex items-center gap-1.5">
								<Smartphone class="h-3.5 w-3.5 text-muted-foreground" />
								{data.lead.contact.mobile}
							</p>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}
		</div>
	</div>
</div>

<!-- Delete confirmation -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Lead</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to permanently delete "{data.lead.title}"? This action cannot be undone.
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
							toast.success('Lead deleted');
							goto('/crm');
						} else {
							toast.error('Failed to delete lead');
						}
					};
				}}
			>
				<input type="hidden" name="id" value={data.lead.id} />
				<Button type="submit" variant="destructive" disabled={isDeleting}>
					{isDeleting ? 'Deleting...' : 'Delete'}
				</Button>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
