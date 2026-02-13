<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import ContactFormModal from '$lib/components/shared/ContactFormModal.svelte';
	import NotesList from '$lib/components/shared/NotesList.svelte';
	import Metric from '$lib/components/shared/Metric.svelte';
	import { toast } from 'svelte-sonner';
	import UserAvatar from '$lib/components/shared/UserAvatar.svelte';
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
		Users,
		ExternalLink,
		Plus,
		Trash2,
		Receipt,
		Tag
	} from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';
	import { createCurrencyFormatter } from '$lib/utils/currency';

	let { data } = $props();

	const fmt = createCurrencyFormatter(data.enums.currency);

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

	function openEditContactModal(contact: typeof contactToEdit) {
		contactToEdit = contact;
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
		<div class="flex flex-col gap-4">
			<!-- Main Info Card -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Vendor Information</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="w-full flex flex-col gap-1">
						{#if data.vendor.email}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Mail class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">Email</span>
								</div>
								<a href="mailto:{data.vendor.email}" class="text-primary hover:underline">
									{data.vendor.email}
								</a>
							</div>
						{/if}

						{#if data.vendor.phone}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Phone class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">Phone</span>
								</div>
								<a href="tel:{data.vendor.phone}" class="hover:underline">
									{data.vendor.phone}
								</a>
							</div>
						{/if}

						{#if data.vendor.website}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Globe class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">Website</span>
								</div>
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
						{/if}

						{#if data.vendor.category}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Tag class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">Category</span>
								</div>
								<p>{data.vendor.category}</p>
							</div>
						{/if}

						{#if data.vendor.street || data.vendor.city || data.vendor.country}
							<div class="flex items-start gap-2">
								<div class="flex items-center gap-2 min-w-[100px] pt-0.5">
									<MapPin class="h-4 w-4 text-muted-foreground mt-0.5" />
									<span class="text-sm text-muted-foreground">Address</span>
								</div>
								<p>
									{#if data.vendor.postalCode}{data.vendor.postalCode}{/if}
									{#if data.vendor.city}{data.vendor.city}<br />{/if}
									{#if data.vendor.street}{data.vendor.street}<br />{/if}
									{#if data.vendor.country}{data.vendor.country}<br />{/if}
								</p>
							</div>
						{/if}

						{#if data.vendor.taxId}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Building2 class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">Reg ID</span>
								</div>
								<p>{data.vendor.taxId}</p>
							</div>
						{/if}

						{#if data.vendor.vatNumber}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Building2 class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">VAT ID</span>
								</div>
								<p>{data.vendor.vatNumber}</p>
							</div>
						{/if}

						{#if data.vendor.paymentTerms}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Building2 class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">Payment</span>
								</div>
								<p>{data.vendor.paymentTerms} days</p>
							</div>
						{/if}

						{#if data.vendor.currency}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Building2 class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">Currency</span>
								</div>
								<p>{data.vendor.currency}</p>
							</div>
						{/if}
					</div>

					{#if data.vendor.notes}
						<div class="pt-4 border-t">
							<p class="text-sm text-muted-foreground mb-1">Notes</p>
							<p class="whitespace-pre-wrap">{data.vendor.notes}</p>
						</div>
					{/if}

					<div class="pt-4 border-t text-sm text-muted-foreground">
						<div class="flex items-center gap-1">
							<Calendar class="h-3 w-3" />
							Created {formatDate(data.vendor.createdAt)}
						</div>
					</div>
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

					{#if data.canViewExpenses}
						<div class="flex items-center justify-between pt-4 border-t">
							<div class="flex items-center gap-2 text-muted-foreground">
								<DollarSign class="h-4 w-4" />
								<span>Total Expenses</span>
							</div>
							<span class="font-semibold text-red-600">
								{fmt.format(Number(data.vendor.totalExpenses), data.vendor.currency)}
							</span>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Tabs for related data -->
		<Tabs.Root value="notes" class="col-span-2">
			<Tabs.List>
				<Tabs.Trigger value="notes">Notes</Tabs.Trigger>
				<Tabs.Trigger value="contacts">
					Contacts ({data.vendor._count.contacts})
				</Tabs.Trigger>
				{#if data.canViewExpenses}
					<Tabs.Trigger value="expenses">
						Expenses ({data.vendor._count.expenses})
					</Tabs.Trigger>
				{/if}
			</Tabs.List>

			<!-- Notes Tab -->
			<Tabs.Content value="notes" class="mt-4">
				<NotesList
					entityType="Vendor"
					entityId={String(data.vendor.id)}
					notePriorities={data.enums.note_priority}
				/>
			</Tabs.Content>

			<!-- Contacts Tab -->
			<Tabs.Content value="contacts" class="mt-4">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-lg font-semibold">Contact Persons</h3>
					<Button variant="outline" size="sm" onclick={openAddContactModal}>
						<Plus class="mr-2 h-4 w-4" />
						Add Contact
					</Button>
				</div>
				<div class="rounded-md border">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Name</Table.Head>
								<Table.Head>Position</Table.Head>
								<Table.Head>Email</Table.Head>
								<Table.Head>Phone</Table.Head>
								<Table.Head>Mobile</Table.Head>
								<Table.Head class="w-[100px]">Actions</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.vendor.contacts as contact}
								<Table.Row>
									<Table.Cell>
										<div class="flex items-center gap-2">
											<UserAvatar user={contact} size="sm" />
											<span class="font-medium">{contact.firstName} {contact.lastName}</span>
										</div>
									</Table.Cell>
									<Table.Cell>
										{#if contact.position}
											{contact.position}
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										{#if contact.email}
											<a href="mailto:{contact.email}" class="text-primary hover:underline">{contact.email}</a>
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										{#if contact.phone}
											<a href="tel:{contact.phone}" class="hover:underline">{contact.phone}</a>
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										{#if contact.mobile}
											<a href="tel:{contact.mobile}" class="hover:underline">{contact.mobile}</a>
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										<div class="flex items-center gap-1">
											<Button variant="ghost" size="icon" onclick={() => openEditContactModal({ ...contact, isPrimaryContact: false })} title="Edit contact">
												<Pencil class="h-4 w-4" />
											</Button>
											<Button variant="ghost" size="icon" onclick={() => confirmDeleteContact(contact)} title="Delete contact">
												<Trash2 class="h-4 w-4" />
											</Button>
										</div>
									</Table.Cell>
								</Table.Row>
							{:else}
								<Table.Row>
									<Table.Cell colspan={6} class="h-24 text-center text-muted-foreground">
										No contacts added yet.
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			</Tabs.Content>

			<!-- Expenses Tab (permission-gated) -->
			{#if data.canViewExpenses}
				<Tabs.Content value="expenses" class="mt-4">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-semibold">Expenses</h3>
						<Button variant="outline" size="sm" href="/finances/expenses/new?vendorId={data.vendor.id}">
							Record Expense
						</Button>
					</div>
					<div class="rounded-md border">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Date</Table.Head>
									<Table.Head>Description</Table.Head>
									<Table.Head>Category</Table.Head>
									<Table.Head>Status</Table.Head>
									<Table.Head class="text-right">Amount</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each data.vendor.expenses as expense}
									<Table.Row
										class="cursor-pointer hover:bg-muted/50"
										onclick={() => goto(`/finances/expenses/${expense.id}`)}
									>
										<Table.Cell>{formatDate(expense.date)}</Table.Cell>
										<Table.Cell class="font-medium">{expense.description}</Table.Cell>
										<Table.Cell>
											<Badge variant="outline">{expense.category}</Badge>
										</Table.Cell>
										<Table.Cell>
											<EnumBadge enums={data.enums.expense_status} value={expense.status} />
										</Table.Cell>
										<Table.Cell class="text-right font-medium text-red-600">
											{fmt.format(Number(expense.amount), expense.currency)}
										</Table.Cell>
									</Table.Row>
								{:else}
									<Table.Row>
										<Table.Cell colspan={5} class="h-24 text-center text-muted-foreground">
											No expenses recorded yet.
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
					{#if data.vendor._count.expenses > 10}
						<div class="mt-2 text-center">
							<Button variant="link" href="/finances/expenses?vendorId={data.vendor.id}">
								View all expenses
							</Button>
						</div>
					{/if}
				</Tabs.Content>
			{/if}
		</Tabs.Root>
	</div>
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
