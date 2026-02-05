<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import * as Alert from '$lib/components/ui/alert';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import {
		ArrowLeft,
		Pencil,
		Mail,
		Phone,
		Smartphone,
		MapPin,
		Calendar,
		Briefcase,
		User,
		Shield,
		AlertTriangle,
		DollarSign,
		X,
		Plus
	} from 'lucide-svelte';

	let { data } = $props();

	let selectedGroupToAdd = $state('');
	let removeGroupDialogOpen = $state(false);
	let groupToRemove = $state<{ id: number; name: string } | null>(null);

	const employmentTypes: Record<string, string> = {
		'full-time': 'Full-time',
		'part-time': 'Part-time',
		contractor: 'Contractor'
	};

	const statusLabels: Record<string, string> = {
		active: 'Active',
		on_leave: 'On Leave',
		terminated: 'Terminated'
	};

	const projectStatusLabels: Record<string, string> = {
		planning: 'Planning',
		active: 'Active',
		on_hold: 'On Hold',
		completed: 'Completed',
		cancelled: 'Cancelled'
	};

	function getStatusBadgeVariant(
		status: string | null
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'active':
				return 'default';
			case 'on_leave':
				return 'secondary';
			case 'terminated':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function getProjectStatusBadgeVariant(
		status: string
	): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'active':
				return 'default';
			case 'completed':
				return 'secondary';
			case 'cancelled':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function formatDate(date: Date | string | null): string {
		if (!date) return '-';
		return new Date(date).toLocaleDateString();
	}

	function formatCurrency(amount: number | null): string {
		if (amount === null) return '-';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function openRemoveGroupDialog(group: { id: number; name: string }) {
		groupToRemove = group;
		removeGroupDialogOpen = true;
	}

	// Get groups the user is not yet in
	$effect(() => {
		selectedGroupToAdd = '';
	});

	let availableGroups = $derived(
		data.allUserGroups.filter(
			(g) => !data.employee.user?.userGroups.some((ug) => ug.userGroup.id === g.id)
		)
	);

	// Convert availableGroups to have string IDs for Select component
	let availableGroupsWithStringIds = $derived(
		availableGroups.map(g => ({ ...g, stringId: String(g.id) }))
	);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" href="/employees">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div>
				<h1 class="text-3xl font-bold tracking-tight">
					{data.employee.firstName}
					{data.employee.lastName}
				</h1>
				<p class="text-muted-foreground">
					{data.employee.jobTitle || 'Employee'}
					{#if data.employee.department}
						&bull; {data.employee.department}
					{/if}
				</p>
			</div>
		</div>
		{#if !data.employee.isDeleted}
			<Button href="/employees/{data.employee.id}/edit">
				<Pencil class="mr-2 h-4 w-4" />
				Edit Employee
			</Button>
		{/if}
	</div>

	{#if data.employee.isDeleted}
		<Alert.Root variant="destructive" class="max-w-4xl">
			<AlertTriangle class="h-4 w-4" />
			<Alert.Title>Deleted Employee</Alert.Title>
			<Alert.Description>
				This employee has been deleted. Only administrators can view this record.
			</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="grid gap-6 md:grid-cols-3">
		<!-- Main Info Card -->
		<Card.Root class="md:col-span-2">
			<Card.Header>
				<Card.Title>Employee Information</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-6">
				<!-- Contact Info -->
				<div class="space-y-3">
					<h4 class="text-sm font-medium text-muted-foreground">Contact Information</h4>
					<div class="grid gap-3">
						{#if data.employee.email}
							<div class="flex items-center gap-2">
								<Mail class="h-4 w-4 text-muted-foreground" />
								<a href="mailto:{data.employee.email}" class="text-primary hover:underline">
									{data.employee.email}
								</a>
							</div>
						{/if}
						{#if data.employee.phone}
							<div class="flex items-center gap-2">
								<Phone class="h-4 w-4 text-muted-foreground" />
								<span>{data.employee.phone}</span>
							</div>
						{/if}
						{#if data.employee.mobile}
							<div class="flex items-center gap-2">
								<Smartphone class="h-4 w-4 text-muted-foreground" />
								<span>{data.employee.mobile}</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- Address -->
				{#if data.employee.street || data.employee.city || data.employee.country}
					<div class="space-y-3">
						<h4 class="text-sm font-medium text-muted-foreground">Address</h4>
						<div class="flex items-start gap-2">
							<MapPin class="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								{#if data.employee.street}
									<div>{data.employee.street}</div>
								{/if}
								<div>
									{[data.employee.city, data.employee.postalCode, data.employee.country]
										.filter(Boolean)
										.join(', ')}
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Employment Details -->
				<div class="space-y-3">
					<h4 class="text-sm font-medium text-muted-foreground">Employment Details</h4>
					<div class="grid grid-cols-2 gap-4">
						<div>
							<div class="text-sm text-muted-foreground">Employment Type</div>
							<div>
								{data.employee.employmentType
									? employmentTypes[data.employee.employmentType] || data.employee.employmentType
									: '-'}
							</div>
						</div>
						<div>
							<div class="text-sm text-muted-foreground">Status</div>
							<div>
								{#if data.employee.employeeStatus}
									<Badge variant={getStatusBadgeVariant(data.employee.employeeStatus)}>
										{statusLabels[data.employee.employeeStatus] || data.employee.employeeStatus}
									</Badge>
								{:else}
									-
								{/if}
							</div>
						</div>
						<div>
							<div class="text-sm text-muted-foreground">Hire Date</div>
							<div class="flex items-center gap-2">
								<Calendar class="h-4 w-4 text-muted-foreground" />
								{formatDate(data.employee.hireDate)}
							</div>
						</div>
						<div>
							<div class="text-sm text-muted-foreground">Date of Birth</div>
							<div>{formatDate(data.employee.dateOfBirth)}</div>
						</div>
					</div>
				</div>

				<!-- Emergency Contact -->
				{#if data.employee.emergencyContact}
					<div class="space-y-3">
						<h4 class="text-sm font-medium text-muted-foreground">Emergency Contact</h4>
						<div>{data.employee.emergencyContact}</div>
					</div>
				{/if}

				<!-- Notes -->
				{#if data.employee.notes}
					<div class="space-y-3">
						<h4 class="text-sm font-medium text-muted-foreground">Notes</h4>
						<div class="whitespace-pre-wrap text-sm">{data.employee.notes}</div>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- Side Cards -->
		<div class="space-y-6">
			<!-- Status Card -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">Status</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="flex items-center gap-2">
						{#if data.employee.isDeleted}
							<Badge variant="destructive">Deleted</Badge>
						{:else if data.employee.employeeStatus}
							<Badge variant={getStatusBadgeVariant(data.employee.employeeStatus)}>
								{statusLabels[data.employee.employeeStatus] || data.employee.employeeStatus}
							</Badge>
						{:else}
							<Badge variant="outline">Unknown</Badge>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- System Access Card -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base flex items-center gap-2">
						<User class="h-4 w-4" />
						System Access
					</Card.Title>
				</Card.Header>
				<Card.Content>
					{#if data.employee.user}
						<div class="space-y-2">
							<div class="flex items-center gap-2 text-sm">
								<Badge variant="default">Has Account</Badge>
							</div>
							<div class="text-sm text-muted-foreground">
								{data.employee.user.email}
							</div>
						</div>
					{:else}
						<div class="text-sm text-muted-foreground">No system account</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Salary Card (if allowed) -->
			{#if data.canViewSalary}
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-base flex items-center gap-2">
							<DollarSign class="h-4 w-4" />
							Compensation
						</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-3">
						<div>
							<div class="text-sm text-muted-foreground">Base Salary</div>
							<div class="text-lg font-semibold">
								{formatCurrency(data.employee.salary ? Number(data.employee.salary) : null)}
							</div>
						</div>
						{#if data.employee.salary_tax}
							<div>
								<div class="text-sm text-muted-foreground">Tax Withholding</div>
								<div>{formatCurrency(Number(data.employee.salary_tax))}</div>
							</div>
						{/if}
						{#if data.employee.salary_bonus}
							<div>
								<div class="text-sm text-muted-foreground">Bonus</div>
								<div class="text-green-600">
									{formatCurrency(Number(data.employee.salary_bonus))}
								</div>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}
		</div>
	</div>

	<!-- Tabs for Projects and Groups -->
	<Tabs.Root value="projects" class="max-w-4xl">
		<Tabs.List>
			<Tabs.Trigger value="projects">
				<Briefcase class="mr-2 h-4 w-4" />
				Projects ({data.employee.assignedProjects.length + data.employee.managedProjects.length})
			</Tabs.Trigger>
			{#if data.employee.user && data.canManagePermissions}
				<Tabs.Trigger value="groups">
					<Shield class="mr-2 h-4 w-4" />
					User Groups ({data.employee.user.userGroups.length})
				</Tabs.Trigger>
			{/if}
		</Tabs.List>

		<Tabs.Content value="projects" class="mt-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>Assigned Projects</Card.Title>
					<Card.Description>Projects this employee is working on</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if data.employee.managedProjects.length > 0 || data.employee.assignedProjects.length > 0}
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Project</Table.Head>
									<Table.Head>Client</Table.Head>
									<Table.Head>Role</Table.Head>
									<Table.Head>Status</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each data.employee.managedProjects as project}
									<Table.Row>
										<Table.Cell>
											<a href="/projects/{project.id}" class="font-medium hover:underline">
												{project.name}
											</a>
										</Table.Cell>
										<Table.Cell>
											<a
												href="/clients/{project.client.id}"
												class="text-muted-foreground hover:underline"
											>
												{project.client.name}
											</a>
										</Table.Cell>
										<Table.Cell>
											<Badge variant="default">Project Manager</Badge>
										</Table.Cell>
										<Table.Cell>
											<Badge variant={getProjectStatusBadgeVariant(project.status)}>
												{projectStatusLabels[project.status] || project.status}
											</Badge>
										</Table.Cell>
									</Table.Row>
								{/each}
								{#each data.employee.assignedProjects as assignment}
									<Table.Row>
										<Table.Cell>
											<a
												href="/projects/{assignment.project.id}"
												class="font-medium hover:underline"
											>
												{assignment.project.name}
											</a>
										</Table.Cell>
										<Table.Cell>
											<a
												href="/clients/{assignment.project.client.id}"
												class="text-muted-foreground hover:underline"
											>
												{assignment.project.client.name}
											</a>
										</Table.Cell>
										<Table.Cell>
											{assignment.role || 'Team Member'}
										</Table.Cell>
										<Table.Cell>
											<Badge variant={getProjectStatusBadgeVariant(assignment.project.status)}>
												{projectStatusLabels[assignment.project.status] ||
													assignment.project.status}
											</Badge>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{:else}
						<div class="text-center py-8 text-muted-foreground">
							No projects assigned to this employee
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		{#if data.employee.user && data.canManagePermissions}
			<Tabs.Content value="groups" class="mt-4">
				<Card.Root>
					<Card.Header>
						<div class="flex items-center justify-between">
							<div>
								<Card.Title>User Groups</Card.Title>
								<Card.Description>Groups this employee belongs to</Card.Description>
							</div>
							{#if availableGroups.length > 0}
								<form
									method="POST"
									action="?/assignGroup"
									use:enhance
									class="flex items-center gap-2"
								>
									<Select.Root type="single" bind:value={selectedGroupToAdd} name="groupId">
										<Select.Trigger class="w-48">
											{availableGroupsWithStringIds.find((g) => g.stringId === selectedGroupToAdd)?.name ||
												'Select group'}
										</Select.Trigger>
										<Select.Content>
											{#each availableGroupsWithStringIds as group}
												<Select.Item value={group.stringId}>{group.name}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
									<input type="hidden" name="groupId" value={selectedGroupToAdd} />
									<Button type="submit" size="sm" disabled={!selectedGroupToAdd}>
										<Plus class="mr-2 h-4 w-4" />
										Add
									</Button>
								</form>
							{/if}
						</div>
					</Card.Header>
					<Card.Content>
						{#if data.employee.user.userGroups.length > 0}
							<div class="space-y-2">
								{#each data.employee.user.userGroups as { userGroup }}
									<div
										class="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
									>
										<div>
											<div class="font-medium">{userGroup.name}</div>
											{#if userGroup.description}
												<div class="text-sm text-muted-foreground">{userGroup.description}</div>
											{/if}
										</div>
										<Button
											variant="ghost"
											size="icon"
											onclick={() => openRemoveGroupDialog(userGroup)}
										>
											<X class="h-4 w-4" />
										</Button>
									</div>
								{/each}
							</div>
						{:else}
							<div class="text-center py-8 text-muted-foreground">
								This employee is not in any user groups
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
		{/if}
	</Tabs.Root>
</div>

<!-- Remove Group Confirmation Dialog -->
<AlertDialog.Root bind:open={removeGroupDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Remove from Group</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to remove {data.employee.firstName}
				{data.employee.lastName} from the "{groupToRemove?.name}" group?
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/removeGroup"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						removeGroupDialogOpen = false;
						groupToRemove = null;
					};
				}}
			>
				<input type="hidden" name="groupId" value={groupToRemove?.id} />
				<Button type="submit" variant="destructive">Remove</Button>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
