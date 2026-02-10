<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import * as Card from '$lib/components/ui/card';
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
		Smartphone,
		Globe,
		MapPin,
		Calendar,
		DollarSign,
		Users,
		ExternalLink,
		Plus,
		Trash2,
		Receipt,
		Tag
	} from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';

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
		avatarPath: string | null;
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

	function openEditContactModal(contact: {
		id: number;
		firstName: string;
		lastName: string;
		email: string | null;
		phone: string | null;
		mobile: string | null;
		position: string | null;
		avatarPath: string | null;
	}) {
		contactToEdit = {
			id: contact.id,
			firstName: contact.firstName,
			lastName: contact.lastName,
			email: contact.email,
			phone: contact.phone,
			mobile: contact.mobile,
			position: contact.position,
			avatarPath: contact.avatarPath,
			isPrimaryContact: false // Vendor contacts don't have primary flag
		};
		contactModalOpen = true;
	}

	function confirmDeleteContact(contact: { id: number; firstName: string; lastName: string }) {
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
	}, avatarFile?: File | null, removeAvatar?: boolean): Promise<{ success: boolean; error?: string }> {
		const formData = new FormData();
		formData.append('firstName', contactData.firstName);
		formData.append('lastName', contactData.lastName);
		formData.append('email', contactData.email || '');
		formData.append('phone', contactData.phone || '');
		formData.append('mobile', contactData.mobile || '');
		formData.append('position', contactData.position || '');

		if (avatarFile) {
			formData.append('avatar', avatarFile);
		}
		if (removeAvatar) {
			formData.append('removeAvatar', 'true');
		}

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

	function formatCurrency(amount: number | string, currency: string): string {
		const num = typeof amount === 'string' ? parseFloat(amount) : amount;
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency
		}).format(num);
	}

</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" href="/vendors">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-3xl font-bold tracking-tight">{data.vendor.name}</h1>
					<EnumBadge enums={data.enums.entity_status} value={data.vendor.status} />
				</div>
				{#if data.vendor.companyName}
					<p class="text-muted-foreground flex items-center gap-1">
						<Building2 class="h-4 w-4" />
						{data.vendor.companyName}
					</p>
				{/if}
			</div>
		</div>
		<Button href="/vendors/{data.vendor.id}/edit">
			<Pencil class="mr-2 h-4 w-4" />
			Edit Vendor
		</Button>
	</div>


	<div class="grid gap-6 md:grid-cols-3">
		<!-- Main Info Card -->
		<Card.Root class="md:col-span-2">
			<Card.Header>
				<Card.Title>Vendor Information</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-2">
					{#if data.vendor.email}
						<div class="flex items-center gap-3">
							<Mail class="h-4 w-4 text-muted-foreground" />
							<div>
								<p class="text-sm text-muted-foreground">Email</p>
								<a href="mailto:{data.vendor.email}" class="text-primary hover:underline">
									{data.vendor.email}
								</a>
							</div>
						</div>
					{/if}

					{#if data.vendor.phone}
						<div class="flex items-center gap-3">
							<Phone class="h-4 w-4 text-muted-foreground" />
							<div>
								<p class="text-sm text-muted-foreground">Phone</p>
								<a href="tel:{data.vendor.phone}" class="hover:underline">
									{data.vendor.phone}
								</a>
							</div>
						</div>
					{/if}

					{#if data.vendor.website}
						<div class="flex items-center gap-3">
							<Globe class="h-4 w-4 text-muted-foreground" />
							<div>
								<p class="text-sm text-muted-foreground">Website</p>
								<a
									href={data.vendor.website}
									target="_blank"
									rel="noopener noreferrer"
									class="text-primary hover:underline flex items-center gap-1"
								>
									{data.vendor.website}
									<ExternalLink class="h-3 w-3" />
								</a>
							</div>
						</div>
					{/if}

					{#if data.vendor.category}
						<div class="flex items-center gap-3">
							<Tag class="h-4 w-4 text-muted-foreground" />
							<div>
								<p class="text-sm text-muted-foreground">Category</p>
								<p>{data.vendor.category}</p>
							</div>
						</div>
					{/if}
				</div>

				{#if data.vendor.street || data.vendor.city || data.vendor.country}
					<div class="flex items-start gap-3 pt-4 border-t">
						<MapPin class="h-4 w-4 text-muted-foreground mt-0.5" />
						<div>
							<p class="text-sm text-muted-foreground">Address</p>
							<p>
								{#if data.vendor.street}{data.vendor.street}<br />{/if}
								{[data.vendor.city, data.vendor.postalCode, data.vendor.country]
									.filter(Boolean)
									.join(', ')}
							</p>
						</div>
					</div>
				{/if}

				{#if data.vendor.notes}
					<div class="pt-4 border-t">
						<p class="text-sm text-muted-foreground mb-1">Notes</p>
						<p class="whitespace-pre-wrap">{data.vendor.notes}</p>
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
					<Metric icon={Receipt} title="Expenses" value={data.vendor._count.expenses} />
					<Metric icon={Users} title="Contacts" value={data.vendor._count.contacts} />
				</div>

				<div class="flex items-center justify-between pt-4 border-t">
					<div class="flex items-center gap-2 text-muted-foreground">
						<DollarSign class="h-4 w-4" />
						<span>Total Expenses</span>
					</div>
					<span class="font-semibold text-red-600">
						{formatCurrency(Number(data.vendor.totalExpenses), data.vendor.currency)}
					</span>
				</div>

				<div class="pt-4 border-t space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-muted-foreground">Payment Terms</span>
						<span>{data.vendor.paymentTerms} days</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Currency</span>
						<span>{data.vendor.currency}</span>
					</div>
					{#if data.vendor.taxId}
						<div class="flex justify-between">
							<span class="text-muted-foreground">Tax ID</span>
							<span>{data.vendor.taxId}</span>
						</div>
					{/if}
					{#if data.vendor.vatNumber}
						<div class="flex justify-between">
							<span class="text-muted-foreground">VAT Number</span>
							<span>{data.vendor.vatNumber}</span>
						</div>
					{/if}
				</div>

				<div class="pt-4 border-t text-sm text-muted-foreground">
					<div class="flex items-center gap-1">
						<Calendar class="h-3 w-3" />
						Created {formatDate(data.vendor.createdAt)}
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Tabs for related data -->
	<Tabs.Root value="contacts" class="w-full">
		<Tabs.List>
			<Tabs.Trigger value="contacts">
				Contacts ({data.vendor._count.contacts})
			</Tabs.Trigger>
			<Tabs.Trigger value="expenses">
				Expenses ({data.vendor._count.expenses})
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
					{#if data.vendor.contacts.length === 0}
						<p class="text-muted-foreground text-center py-8">No contacts added yet.</p>
					{:else}
						<div class="space-y-3">
							{#each data.vendor.contacts as contact}
								<div class="flex items-center gap-3 p-3 rounded-lg border">
									<Avatar.Root>
										{#if contact.avatarPath}
											<Avatar.Image src="/api/uploads/{contact.avatarPath}" alt="{contact.firstName} {contact.lastName}" />
										{/if}
										<Avatar.Fallback class="text-xs">{contact.firstName[0]}{contact.lastName[0]}</Avatar.Fallback>
									</Avatar.Root>
									<div class="min-w-0">
										<p class="font-medium">
											{contact.firstName} {contact.lastName}
										</p>
										{#if contact.position}
											<p class="text-sm text-muted-foreground">{contact.position}</p>
										{/if}
									</div>
									<div class="flex items-center gap-3 ml-auto text-sm text-muted-foreground">
										{#if contact.email}
											<a href="mailto:{contact.email}" class="flex items-center gap-1 text-primary hover:underline" title={contact.email}>
												<Mail class="h-3.5 w-3.5 shrink-0" />
												<span class="hidden lg:inline">{contact.email}</span>
											</a>
										{/if}
										{#if contact.phone}
											<a href="tel:{contact.phone}" class="flex items-center gap-1 hover:underline" title={contact.phone}>
												<Phone class="h-3.5 w-3.5 shrink-0" />
												<span class="hidden lg:inline">{contact.phone}</span>
											</a>
										{/if}
										{#if contact.mobile}
											<a href="tel:{contact.mobile}" class="flex items-center gap-1 hover:underline" title={contact.mobile}>
												<Smartphone class="h-3.5 w-3.5 shrink-0" />
												<span class="hidden lg:inline">{contact.mobile}</span>
											</a>
										{/if}
									</div>
									<div class="flex items-center gap-1 shrink-0">
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
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="expenses" class="mt-4">
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between">
					<Card.Title>Recent Expenses</Card.Title>
					<Button variant="outline" size="sm" href="/finances/expenses/new?vendorId={data.vendor.id}">
						Record Expense
					</Button>
				</Card.Header>
				<Card.Content>
					{#if data.vendor.expenses.length === 0}
						<p class="text-muted-foreground text-center py-8">No expenses recorded yet.</p>
					{:else}
						<div class="space-y-3">
							{#each data.vendor.expenses as expense}
								<a
									href="/finances/expenses/{expense.id}"
									class="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
								>
									<div>
										<p class="font-medium">{expense.description}</p>
										<p class="text-sm text-muted-foreground">
											{formatDate(expense.date)} - {expense.category}
										</p>
									</div>
									<p class="font-medium text-red-600">
										{formatCurrency(Number(expense.amount), expense.currency)}
									</p>
								</a>
							{/each}
						</div>
						{#if data.vendor._count.expenses > 5}
							<div class="mt-4 text-center">
								<Button variant="link" href="/finances/expenses?vendorId={data.vendor.id}">
									View all expenses
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
				Are you sure you want to delete <strong>{contactToDelete?.name}</strong>? This action cannot be undone.
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
