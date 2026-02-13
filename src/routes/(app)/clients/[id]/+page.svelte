<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
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
	import UserAvatar from '$lib/components/shared/UserAvatar.svelte';
	import { toast } from 'svelte-sonner';
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
		Briefcase,
		Users,
		FileText,
		ListChecks,
		ExternalLink,
		Plus,
		Trash2
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
	}, avatarFile?: File | null, removeAvatar?: boolean): Promise<{ success: boolean; error?: string }> {
		const formData = new FormData();
		formData.append('firstName', contactData.firstName);
		formData.append('lastName', contactData.lastName);
		formData.append('email', contactData.email || '');
		formData.append('phone', contactData.phone || '');
		formData.append('mobile', contactData.mobile || '');
		formData.append('position', contactData.position || '');
		formData.append('isPrimaryContact', contactData.isPrimaryContact.toString());

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
			<Button variant="ghost" size="icon" href="/clients">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-3xl font-bold tracking-tight">{data.client.name}</h1>
					<EnumBadge enums={data.enums.entity_status} value={data.client.status} />
				</div>
				{#if data.client.companyName}
					<p class="text-muted-foreground flex items-center gap-1">
						<Building2 class="h-4 w-4" />
						{data.client.companyName}
					</p>
				{/if}
			</div>
		</div>
		<Button href="/clients/{data.client.id}/edit">
			<Pencil class="mr-2 h-4 w-4" />
			Edit Client
		</Button>
	</div>

	<div class="grid gap-6 md:grid-cols-3">
		<div class="flex flex-col gap-4">
			<!-- Main Info Card -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Client Information</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="w-full flex flex-col gap-1">
						{#if data.client.email}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Mail class="h-4 w-4 text-muted-foreground"/>
									<span class="text-sm text-muted-foreground">Email</span>
								</div>
								<a href="mailto:{data.client.email}" class="text-primary hover:underline">
									{data.client.email}
								</a>
							</div>
						{/if}

						{#if data.client.phone}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Phone class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">Phone</span>
								</div>
								<a href="tel:{data.client.phone}" class="hover:underline">
									{data.client.phone}
								</a>
							</div>
						{/if}

						{#if data.client.website}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Globe class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">Website</span>
								</div>
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
						{/if}

						{#if data.client.industry}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Building2 class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">Industry</span>
								</div>
								<p>{data.client.industry}</p>
							</div>
						{/if}

						{#if data.client.street || data.client.city || data.client.country}
							<div class="flex items-start gap-2">
								<div class="flex items-center gap-2 min-w-[100px] pt-0.5">
									<MapPin class="h-4 w-4 text-muted-foreground mt-0.5" />
									<span class="text-sm text-muted-foreground">Address</span>
								</div>
								<p>
									{#if data.client.postalCode}{data.client.postalCode}{/if}
									{#if data.client.city}{data.client.city}<br />{/if}
									{#if data.client.street}{data.client.street}<br />{/if}
									{#if data.client.country}{data.client.country}<br />{/if}
								</p>
							</div>
						{/if}

						{#if data.client.taxId}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Building2 class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">Reg ID</span>
								</div>
								<p>{data.client.taxId}</p>
							</div>
						{/if}

						{#if data.client.vatNumber}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Building2 class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">VAT ID</span>
								</div>
								<p>{data.client.vatNumber}</p>
							</div>
						{/if}

						{#if data.client.paymentTerms}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Building2 class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">Payment</span>
								</div>
								<p>{data.client.paymentTerms} days</p>
							</div>
						{/if}

						{#if data.client.currency}
							<div class="flex items-center gap-2">
								<div class="flex items-center gap-2 min-w-[100px]">
									<Building2 class="h-4 w-4 text-muted-foreground" />
									<span class="text-sm text-muted-foreground">Currency</span>
								</div>
								<p>{data.client.currency}</p>
							</div>
						{/if}
					</div>

					{#if data.client.notes}
						<div class="pt-4 border-t">
							<p class="text-sm text-muted-foreground mb-1">Notes</p>
							<p class="whitespace-pre-wrap">{data.client.notes}</p>
						</div>
					{/if}

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

					{#if data.canViewIncome}
						<div class="flex items-center justify-between pt-4 border-t">
							<div class="flex items-center gap-2 text-muted-foreground">
								<DollarSign class="h-4 w-4" />
								<span>Total Income</span>
							</div>
							<span class="font-semibold text-green-600">
								{fmt.format(Number(data.client.totalIncome), data.client.currency)}
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
					Contacts ({data.client._count.contacts})
				</Tabs.Trigger>
				<Tabs.Trigger value="projects">
					Projects ({data.client._count.projects})
				</Tabs.Trigger>
				<Tabs.Trigger value="boards">
					Boards ({data.boardCount})
				</Tabs.Trigger>
				<Tabs.Trigger value="tasks">
					Tasks ({data.taskCount})
				</Tabs.Trigger>
				{#if data.canViewOffers}
					<Tabs.Trigger value="offers">
						Offers ({data.client._count.offers})
					</Tabs.Trigger>
				{/if}
				{#if data.canViewIncome}
					<Tabs.Trigger value="income">
						Income ({data.client._count.income})
					</Tabs.Trigger>
				{/if}
				{#if data.canViewExpenses}
					<Tabs.Trigger value="expenses">
						Expenses ({data.expenseCount})
					</Tabs.Trigger>
				{/if}
			</Tabs.List>

			<!-- Notes Tab -->
			<Tabs.Content value="notes" class="mt-4">
				<NotesList
					entityType="Client"
					entityId={String(data.client.id)}
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
							{#each data.client.contacts as contact}
								<Table.Row>
									<Table.Cell>
										<div class="flex items-center gap-2">
											<UserAvatar user={contact} size="sm" />
											<span class="font-medium">{contact.firstName} {contact.lastName}</span>
											{#if contact.isPrimaryContact}
												<Badge variant="secondary">Primary</Badge>
											{/if}
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
											<Button variant="ghost" size="icon" onclick={() => openEditContactModal(contact)} title="Edit contact">
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

			<!-- Projects Tab -->
			<Tabs.Content value="projects" class="mt-4">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-lg font-semibold">Projects</h3>
					<Button variant="outline" size="sm" href="/projects/new?clientId={data.client.id}">
						New Project
					</Button>
				</div>
				<div class="rounded-md border">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Name</Table.Head>
								<Table.Head>Status</Table.Head>
								<Table.Head>Start Date</Table.Head>
								<Table.Head>End Date</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.client.projects as project}
								<Table.Row
									class="cursor-pointer hover:bg-muted/50"
									onclick={() => goto(`/projects/${project.id}`)}
								>
									<Table.Cell class="font-medium">{project.name}</Table.Cell>
									<Table.Cell>
										<EnumBadge enums={data.enums.project_status} value={project.status} />
									</Table.Cell>
									<Table.Cell>
										{#if project.startDate}
											{formatDate(project.startDate)}
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										{#if project.endDate}
											{formatDate(project.endDate)}
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</Table.Cell>
								</Table.Row>
							{:else}
								<Table.Row>
									<Table.Cell colspan={4} class="h-24 text-center text-muted-foreground">
										No projects yet.
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
				{#if data.client._count.projects > 10}
					<div class="mt-2 text-center">
						<Button variant="link" href="/projects?clientId={data.client.id}">
							View all projects
						</Button>
					</div>
				{/if}
			</Tabs.Content>

			<!-- Boards Tab -->
			<Tabs.Content value="boards" class="mt-4">
				<div class="rounded-md border">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Board</Table.Head>
								<Table.Head>Project</Table.Head>
								<Table.Head class="text-center">Members</Table.Head>
								<Table.Head class="text-center">Tasks</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.boards as board}
								<Table.Row
									class="cursor-pointer hover:bg-muted/50"
									onclick={() => goto(`/projects/boards/${board.id}`)}
								>
									<Table.Cell>
										<div>
											<p class="font-medium">{board.name}</p>
											{#if board.description}
												<p class="text-sm text-muted-foreground">{board.description}</p>
											{/if}
										</div>
									</Table.Cell>
									<Table.Cell>{board.project.name}</Table.Cell>
									<Table.Cell class="text-center">
										<span class="flex items-center justify-center gap-1">
											<Users class="h-3 w-3" />
											{board._count.members}
										</span>
									</Table.Cell>
									<Table.Cell class="text-center">
										<span class="flex items-center justify-center gap-1">
											<ListChecks class="h-3 w-3" />
											{board._count.tasks}
										</span>
									</Table.Cell>
								</Table.Row>
							{:else}
								<Table.Row>
									<Table.Cell colspan={4} class="h-24 text-center text-muted-foreground">
										No kanban boards yet.
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
				{#if data.boardCount > 10}
					<div class="mt-2 text-center">
						<p class="text-sm text-muted-foreground">Showing 10 of {data.boardCount} boards</p>
					</div>
				{/if}
			</Tabs.Content>

			<!-- Tasks Tab -->
			<Tabs.Content value="tasks" class="mt-4">
				<div class="rounded-md border">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Priority</Table.Head>
								<Table.Head>Task</Table.Head>
								<Table.Head>Project</Table.Head>
								<Table.Head>Assignee</Table.Head>
								<Table.Head>Status</Table.Head>
								<Table.Head>Due Date</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.tasks as task}
								<Table.Row>
									<Table.Cell>
										{@const pEnum = data.enums.priority?.find((e) => e.value === task.priority)}
										<div class="flex items-center gap-1.5">
											{#if pEnum?.color}
												<span class="shrink-0 rounded-full" style="width:10px;height:10px;background-color:{pEnum.color}"></span>
											{/if}
											<span class="text-sm text-muted-foreground">{pEnum?.label ?? task.priority}</span>
										</div>
									</Table.Cell>
									<Table.Cell class="font-medium">{task.name}</Table.Cell>
									<Table.Cell>{task.project.name}</Table.Cell>
									<Table.Cell>
										{#if task.assignedTo}
											<div class="flex items-center gap-2">
												<UserAvatar user={task.assignedTo} size="xs" />
												<span class="text-sm">{task.assignedTo.firstName} {task.assignedTo.lastName}</span>
											</div>
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										{@const sEnum = data.enums.task_status?.find((e) => e.value === task.status)}
										<Badge variant="outline" style={sEnum?.color ? `color:${sEnum.color};border-color:${sEnum.color}` : ''}>
											{sEnum?.label ?? task.status}
										</Badge>
									</Table.Cell>
									<Table.Cell>
										{#if task.dueDate}
											{formatDate(task.dueDate)}
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</Table.Cell>
								</Table.Row>
							{:else}
								<Table.Row>
									<Table.Cell colspan={6} class="h-24 text-center text-muted-foreground">
										No open tasks.
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
				{#if data.taskCount > 10}
					<div class="mt-2 text-center">
						<p class="text-sm text-muted-foreground">Showing 10 of {data.taskCount} open tasks</p>
					</div>
				{/if}
			</Tabs.Content>

			<!-- Offers Tab (permission-gated) -->
			{#if data.canViewOffers}
				<Tabs.Content value="offers" class="mt-4">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-semibold">Offers</h3>
						<Button variant="outline" size="sm" href="/offers/new?clientId={data.client.id}">
							New Offer
						</Button>
					</div>
					<div class="rounded-md border">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Offer #</Table.Head>
									<Table.Head>Date</Table.Head>
									<Table.Head>Status</Table.Head>
									<Table.Head class="text-right">Total</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each data.client.offers as offer}
									<Table.Row
										class="cursor-pointer hover:bg-muted/50"
										onclick={() => goto(`/offers/${offer.id}`)}
									>
										<Table.Cell class="font-medium">{offer.offerNumber}</Table.Cell>
										<Table.Cell>{formatDate(offer.date)}</Table.Cell>
										<Table.Cell>
											<EnumBadge enums={data.enums.offer_status} value={offer.status} />
										</Table.Cell>
										<Table.Cell class="text-right font-medium">
											{fmt.format(Number(offer.grandTotal), offer.currency)}
										</Table.Cell>
									</Table.Row>
								{:else}
									<Table.Row>
										<Table.Cell colspan={4} class="h-24 text-center text-muted-foreground">
											No offers yet.
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
					{#if data.client._count.offers > 10}
						<div class="mt-2 text-center">
							<Button variant="link" href="/offers?clientId={data.client.id}">
								View all offers
							</Button>
						</div>
					{/if}
				</Tabs.Content>
			{/if}

			<!-- Income Tab (permission-gated) -->
			{#if data.canViewIncome}
				<Tabs.Content value="income" class="mt-4">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-semibold">Income</h3>
						<Button variant="outline" size="sm" href="/finances/income/new?clientId={data.client.id}">
							Record Income
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
								{#each data.client.income as income}
									<Table.Row
										class="cursor-pointer hover:bg-muted/50"
										onclick={() => goto(`/finances/income/${income.id}`)}
									>
										<Table.Cell>{formatDate(income.date)}</Table.Cell>
										<Table.Cell class="font-medium">{income.description}</Table.Cell>
										<Table.Cell>
											<Badge variant="outline">{income.category}</Badge>
										</Table.Cell>
										<Table.Cell>
											<EnumBadge enums={data.enums.income_status} value={income.status} />
										</Table.Cell>
										<Table.Cell class="text-right font-medium text-green-600">
											{fmt.format(Number(income.amount), income.currency)}
										</Table.Cell>
									</Table.Row>
								{:else}
									<Table.Row>
										<Table.Cell colspan={5} class="h-24 text-center text-muted-foreground">
											No income recorded yet.
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
					{#if data.client._count.income > 10}
						<div class="mt-2 text-center">
							<Button variant="link" href="/finances/income?clientId={data.client.id}">
								View all income
							</Button>
						</div>
					{/if}
				</Tabs.Content>
			{/if}

			<!-- Expenses Tab (permission-gated) -->
			{#if data.canViewExpenses}
				<Tabs.Content value="expenses" class="mt-4">
					<div class="rounded-md border">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Date</Table.Head>
									<Table.Head>Description</Table.Head>
									<Table.Head>Vendor</Table.Head>
									<Table.Head>Category</Table.Head>
									<Table.Head>Status</Table.Head>
									<Table.Head class="text-right">Amount</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each data.expenses as expense}
									<Table.Row
										class="cursor-pointer hover:bg-muted/50"
										onclick={() => goto(`/finances/expenses/${expense.id}`)}
									>
										<Table.Cell>{formatDate(expense.date)}</Table.Cell>
										<Table.Cell class="font-medium">{expense.description}</Table.Cell>
										<Table.Cell>
											{#if expense.vendor}
												<a href="/vendors/{expense.vendor.id}" class="hover:underline" onclick={(e) => e.stopPropagation()}>
													{expense.vendor.name}
												</a>
											{:else if expense.vendorName}
												<span class="text-muted-foreground">{expense.vendorName}</span>
											{:else}
												<span class="text-muted-foreground">-</span>
											{/if}
										</Table.Cell>
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
										<Table.Cell colspan={6} class="h-24 text-center text-muted-foreground">
											No expenses recorded yet.
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
					{#if data.expenseCount > 10}
						<div class="mt-2 text-center">
							<p class="text-sm text-muted-foreground">Showing 10 of {data.expenseCount} expenses</p>
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
