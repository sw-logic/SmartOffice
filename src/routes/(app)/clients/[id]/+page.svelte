<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Alert from '$lib/components/ui/alert';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import ContactFormModal from '$lib/components/shared/ContactFormModal.svelte';
	import Metric from '$lib/components/shared/Metric.svelte';
	import { toast } from 'svelte-sonner';
	import * as Avatar from '$lib/components/ui/avatar';
	import {
		ArrowLeft,
		Pencil,
		Building2,
		Mail,
		Phone,
		Globe,
		MapPin,
		Calendar,
		DollarSign,
		Briefcase,
		Users,
		FileText,
		AlertTriangle,
		ExternalLink,
		Plus,
		Trash2
	} from 'lucide-svelte';

	let { data } = $props();

	// Contact modal state
	let contactModalOpen = $state(false);
	let contactToEdit = $state<{
		id: number;
		firstName: string;
		lastName: string;
		email: string | null;
		phone: string | null;
		mobile: string | null;
		position: string | null;
		isPrimaryContact: boolean;
	} | null>(null);

	// Delete contact dialog state
	let deleteContactDialogOpen = $state(false);
	let contactToDelete = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);

	function openAddContactModal() {
		contactToEdit = null;
		contactModalOpen = true;
	}

	function openEditContactModal(contact: typeof contactToEdit) {
		contactToEdit = contact;
		contactModalOpen = true;
	}

	function confirmDeleteContact(contact: { id: number; firstName: string; lastName: string; email?: string | null; phone?: string | null; mobile?: string | null; position?: string | null; isPrimaryContact?: boolean }) {
		contactToDelete = { id: contact.id, name: `${contact.firstName} ${contact.lastName}` };
		deleteContactDialogOpen = true;
	}

	async function handleContactSubmit(contactData: {
		firstName: string;
		lastName: string;
		email: string | null;
		phone: string | null;
		mobile: string | null;
		position: string | null;
		isPrimaryContact: boolean;
	}): Promise<{ success: boolean; error?: string }> {
		const formData = new FormData();
		formData.append('firstName', contactData.firstName);
		formData.append('lastName', contactData.lastName);
		formData.append('email', contactData.email || '');
		formData.append('phone', contactData.phone || '');
		formData.append('mobile', contactData.mobile || '');
		formData.append('position', contactData.position || '');
		formData.append('isPrimaryContact', contactData.isPrimaryContact.toString());

		const action = contactToEdit?.id ? 'updateContact' : 'createContact';
		if (contactToEdit?.id) {
			formData.append('contactId', String(contactToEdit.id));
		}

		try {
			const response = await fetch(`?/${action}`, {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success(contactToEdit?.id ? 'Contact updated successfully' : 'Contact added successfully');
				await invalidateAll();
				return { success: true };
			} else {
				return { success: false, error: result.data?.error || 'Failed to save contact' };
			}
		} catch {
			return { success: false, error: 'An unexpected error occurred' };
		}
	}

	async function handleDeleteContact() {
		if (!contactToDelete) return;

		isDeleting = true;
		const formData = new FormData();
		formData.append('contactId', String(contactToDelete.id));

		try {
			const response = await fetch('?/deleteContact', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success('Contact deleted successfully');
				await invalidateAll();
			} else {
				toast.error(result.data?.error || 'Failed to delete contact');
			}
		} catch {
			toast.error('An unexpected error occurred');
		} finally {
			isDeleting = false;
			deleteContactDialogOpen = false;
			contactToDelete = null;
		}
	}

	function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'active':
				return 'default';
			case 'inactive':
				return 'secondary';
			case 'archived':
				return 'outline';
			default:
				return 'secondary';
		}
	}

	function getProjectStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'active':
				return 'default';
			case 'completed':
				return 'secondary';
			case 'on_hold':
				return 'outline';
			case 'cancelled':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function getOfferStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'accepted':
				return 'default';
			case 'sent':
				return 'secondary';
			case 'draft':
				return 'outline';
			case 'rejected':
			case 'expired':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function formatCurrency(amount: number | string, currency: string): string {
		const num = typeof amount === 'string' ? parseFloat(amount) : amount;
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency
		}).format(num);
	}

	function formatDate(date: string | Date): string {
		return new Date(date).toLocaleDateString();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" href="/clients">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-3xl font-bold tracking-tight">{data.client.name}</h1>
					{#if data.client.isDeleted}
						<Badge variant="destructive">Deleted</Badge>
					{:else}
						<Badge variant={getStatusBadgeVariant(data.client.status)}>
							{data.client.status.charAt(0).toUpperCase() + data.client.status.slice(1)}
						</Badge>
					{/if}
				</div>
				{#if data.client.companyName}
					<p class="text-muted-foreground flex items-center gap-1">
						<Building2 class="h-4 w-4" />
						{data.client.companyName}
					</p>
				{/if}
			</div>
		</div>
		{#if !data.client.isDeleted || data.isAdmin}
			<Button href="/clients/{data.client.id}/edit">
				<Pencil class="mr-2 h-4 w-4" />
				Edit Client
			</Button>
		{/if}
	</div>

	{#if data.client.isDeleted}
		<Alert.Root variant="destructive">
			<AlertTriangle class="h-4 w-4" />
			<Alert.Title>Deleted Client</Alert.Title>
			<Alert.Description>
				This client has been deleted. Only administrators can view and edit this record.
			</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="grid gap-6 md:grid-cols-3">
		<!-- Main Info Card -->
		<Card.Root class="md:col-span-2">
			<Card.Header>
				<Card.Title>Client Information</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-2">
					{#if data.client.email}
						<div class="flex items-center gap-3">
							<Mail class="h-4 w-4 text-muted-foreground" />
							<div>
								<p class="text-sm text-muted-foreground">Email</p>
								<a href="mailto:{data.client.email}" class="text-primary hover:underline">
									{data.client.email}
								</a>
							</div>
						</div>
					{/if}

					{#if data.client.phone}
						<div class="flex items-center gap-3">
							<Phone class="h-4 w-4 text-muted-foreground" />
							<div>
								<p class="text-sm text-muted-foreground">Phone</p>
								<a href="tel:{data.client.phone}" class="hover:underline">
									{data.client.phone}
								</a>
							</div>
						</div>
					{/if}

					{#if data.client.website}
						<div class="flex items-center gap-3">
							<Globe class="h-4 w-4 text-muted-foreground" />
							<div>
								<p class="text-sm text-muted-foreground">Website</p>
								<a
									href={data.client.website}
									target="_blank"
									rel="noopener noreferrer"
									class="text-primary hover:underline flex items-center gap-1"
								>
									{data.client.website}
									<ExternalLink class="h-3 w-3" />
								</a>
							</div>
						</div>
					{/if}

					{#if data.client.industry}
						<div class="flex items-center gap-3">
							<Building2 class="h-4 w-4 text-muted-foreground" />
							<div>
								<p class="text-sm text-muted-foreground">Industry</p>
								<p>{data.client.industry}</p>
							</div>
						</div>
					{/if}
				</div>

				{#if data.client.street || data.client.city || data.client.country}
					<div class="flex items-start gap-3 pt-4 border-t">
						<MapPin class="h-4 w-4 text-muted-foreground mt-0.5" />
						<div>
							<p class="text-sm text-muted-foreground">Address</p>
							<p>
								{#if data.client.street}{data.client.street}<br />{/if}
								{[data.client.city, data.client.postalCode, data.client.country]
									.filter(Boolean)
									.join(', ')}
							</p>
						</div>
					</div>
				{/if}

				{#if data.client.notes}
					<div class="pt-4 border-t">
						<p class="text-sm text-muted-foreground mb-1">Notes</p>
						<p class="whitespace-pre-wrap">{data.client.notes}</p>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- Stats Card -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Overview</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex justify-around">
					<Metric icon={Briefcase} title="Projects" value={data.client._count.projects} />
					<Metric icon={Users} title="Contacts" value={data.client._count.contacts} />
					<Metric icon={FileText} title="Offers" value={data.client._count.offers} />
				</div>

				<div class="flex items-center justify-between pt-4 border-t">
					<div class="flex items-center gap-2 text-muted-foreground">
						<DollarSign class="h-4 w-4" />
						<span>Total Income</span>
					</div>
					<span class="font-semibold text-green-600">
						{formatCurrency(data.client.totalIncome, data.client.currency)}
					</span>
				</div>

				<div class="pt-4 border-t space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-muted-foreground">Payment Terms</span>
						<span>{data.client.paymentTerms} days</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Currency</span>
						<span>{data.client.currency}</span>
					</div>
					{#if data.client.taxId}
						<div class="flex justify-between">
							<span class="text-muted-foreground">Tax ID</span>
							<span>{data.client.taxId}</span>
						</div>
					{/if}
					{#if data.client.vatNumber}
						<div class="flex justify-between">
							<span class="text-muted-foreground">VAT Number</span>
							<span>{data.client.vatNumber}</span>
						</div>
					{/if}
				</div>

				<div class="pt-4 border-t text-sm text-muted-foreground">
					<div class="flex items-center gap-1">
						<Calendar class="h-3 w-3" />
						Created {formatDate(data.client.createdAt)}
					</div>
					<div class="mt-1">
						by {data.client.createdBy.name}
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Tabs for related data -->
	<Tabs.Root value="contacts" class="w-full">
		<Tabs.List>
			<Tabs.Trigger value="contacts">
				Contacts ({data.client._count.contacts})
			</Tabs.Trigger>
			<Tabs.Trigger value="projects">
				Projects ({data.client._count.projects})
			</Tabs.Trigger>
			<Tabs.Trigger value="offers">
				Offers ({data.client._count.offers})
			</Tabs.Trigger>
			<Tabs.Trigger value="income">
				Income ({data.client._count.income})
			</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="contacts" class="mt-4">
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between">
					<Card.Title>Contact Persons</Card.Title>
					<Button variant="outline" size="sm" onclick={openAddContactModal}>
						<Plus class="mr-2 h-4 w-4" />
						Add Contact
					</Button>
				</Card.Header>
				<Card.Content>
					{#if data.client.contacts.length === 0}
						<p class="text-muted-foreground text-center py-8">No contacts added yet.</p>
					{:else}
						<div class="space-y-4">
							{#each data.client.contacts as contact}
								<div class="flex items-center justify-between p-3 rounded-lg border">
									<div class="flex items-center gap-3 flex-1">
										<Avatar.Root>
											<Avatar.Fallback class="text-xs">{contact.firstName[0]}{contact.lastName[0]}</Avatar.Fallback>
										</Avatar.Root>
										<div>
											<div class="flex items-center gap-2">
												<p class="font-medium">
													{contact.firstName} {contact.lastName}
												</p>
												{#if contact.isPrimaryContact}
													<Badge variant="secondary">Primary</Badge>
												{/if}
											</div>
											{#if contact.position}
												<p class="text-sm text-muted-foreground">{contact.position}</p>
											{/if}
										</div>
									</div>
									<div class="flex items-center gap-4">
										<div class="text-sm text-right">
											{#if contact.email}
												<a href="mailto:{contact.email}" class="text-primary hover:underline block">
													{contact.email}
												</a>
											{/if}
											{#if contact.phone}
												<span class="text-muted-foreground">{contact.phone}</span>
											{/if}
										</div>
										<div class="flex items-center gap-1">
											<Button
												variant="ghost"
												size="icon"
												onclick={() => openEditContactModal(contact)}
												title="Edit contact"
											>
												<Pencil class="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onclick={() => confirmDeleteContact(contact)}
												title="Delete contact"
											>
												<Trash2 class="h-4 w-4" />
											</Button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="projects" class="mt-4">
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between">
					<Card.Title>Recent Projects</Card.Title>
					<Button variant="outline" size="sm" href="/projects/new?clientId={data.client.id}">
						New Project
					</Button>
				</Card.Header>
				<Card.Content>
					{#if data.client.projects.length === 0}
						<p class="text-muted-foreground text-center py-8">No projects yet.</p>
					{:else}
						<div class="space-y-3">
							{#each data.client.projects as project}
								<a
									href="/projects/{project.id}"
									class="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
								>
									<div>
										<p class="font-medium">{project.name}</p>
										{#if project.startDate}
											<p class="text-sm text-muted-foreground">
												Started {formatDate(project.startDate)}
											</p>
										{/if}
									</div>
									<Badge variant={getProjectStatusVariant(project.status)}>
										{project.status.replace('_', ' ')}
									</Badge>
								</a>
							{/each}
						</div>
						{#if data.client._count.projects > 5}
							<div class="mt-4 text-center">
								<Button variant="link" href="/projects?clientId={data.client.id}">
									View all projects
								</Button>
							</div>
						{/if}
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="offers" class="mt-4">
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between">
					<Card.Title>Recent Offers</Card.Title>
					<Button variant="outline" size="sm" href="/offers/new?clientId={data.client.id}">
						New Offer
					</Button>
				</Card.Header>
				<Card.Content>
					{#if data.client.offers.length === 0}
						<p class="text-muted-foreground text-center py-8">No offers yet.</p>
					{:else}
						<div class="space-y-3">
							{#each data.client.offers as offer}
								<a
									href="/offers/{offer.id}"
									class="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
								>
									<div>
										<p class="font-medium">{offer.offerNumber}</p>
										<p class="text-sm text-muted-foreground">
											{formatDate(offer.date)}
										</p>
									</div>
									<div class="text-right">
										<p class="font-medium">
											{formatCurrency(Number(offer.grandTotal), offer.currency)}
										</p>
										<Badge variant={getOfferStatusVariant(offer.status)}>
											{offer.status}
										</Badge>
									</div>
								</a>
							{/each}
						</div>
						{#if data.client._count.offers > 5}
							<div class="mt-4 text-center">
								<Button variant="link" href="/offers?clientId={data.client.id}">
									View all offers
								</Button>
							</div>
						{/if}
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="income" class="mt-4">
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between">
					<Card.Title>Recent Income</Card.Title>
					<Button variant="outline" size="sm" href="/finances/income/new?clientId={data.client.id}">
						Record Income
					</Button>
				</Card.Header>
				<Card.Content>
					{#if data.client.income.length === 0}
						<p class="text-muted-foreground text-center py-8">No income recorded yet.</p>
					{:else}
						<div class="space-y-3">
							{#each data.client.income as income}
								<a
									href="/finances/income/{income.id}"
									class="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
								>
									<div>
										<p class="font-medium">{income.description}</p>
										<p class="text-sm text-muted-foreground">
											{formatDate(income.date)} - {income.category}
										</p>
									</div>
									<p class="font-medium text-green-600">
										{formatCurrency(Number(income.amount), income.currency)}
									</p>
								</a>
							{/each}
						</div>
						{#if data.client._count.income > 5}
							<div class="mt-4 text-center">
								<Button variant="link" href="/finances/income?clientId={data.client.id}">
									View all income
								</Button>
							</div>
						{/if}
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>

<!-- Contact Form Modal -->
<ContactFormModal
	bind:open={contactModalOpen}
	onOpenChange={(open) => contactModalOpen = open}
	contact={contactToEdit}
	onSubmit={handleContactSubmit}
	title="Add Contact"
/>

<!-- Delete Contact Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteContactDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Contact</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{contactToDelete?.name}</strong>? This action can be undone by an administrator.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				onclick={handleDeleteContact}
				disabled={isDeleting}
			>
				{isDeleting ? 'Deleting...' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
