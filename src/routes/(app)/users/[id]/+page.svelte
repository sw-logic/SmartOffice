<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import {
		ArrowLeft,
		Pencil,
		Trash2,
		Mail,
		Phone,
		Smartphone,
		MapPin,
		Building2,
		Calendar,
		Briefcase,
		FolderKanban,
		ListChecks,
		Clock,
		Shield
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	let deleteDialogOpen = $state(false);
	let isDeleting = $state(false);

	function getInitials(user: { name: string; firstName?: string | null; lastName?: string | null }): string {
		if (user.firstName && user.lastName) {
			return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
		}
		return user.name
			.split(' ')
			.map((w: string) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function getDisplayName(user: { name: string; firstName?: string | null; lastName?: string | null }): string {
		if (user.firstName && user.lastName) {
			return `${user.firstName} ${user.lastName}`;
		}
		return user.name;
	}

	function formatCurrency(amount: number | null): string {
		if (amount === null || amount === undefined) return '-';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
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

		if (result.type === 'success') {
			toast.success('User deleted successfully');
			goto('/users');
		} else {
			toast.error(result.data?.error || 'Failed to delete user');
			isDeleting = false;
			deleteDialogOpen = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" href="/users">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<Avatar.Root class="h-12 w-12">
				{#if data.user.image}
					<Avatar.Image src="/api/uploads/{data.user.image}" alt={getDisplayName(data.user)} />
				{/if}
				<Avatar.Fallback class="text-lg">{getInitials(data.user)}</Avatar.Fallback>
			</Avatar.Root>
			<div>
				<h1 class="text-2xl font-bold tracking-tight">{getDisplayName(data.user)}</h1>
				<p class="text-muted-foreground">{data.user.jobTitle || data.user.email}</p>
			</div>
			{#if data.user.employeeStatus}
				<EnumBadge enums={data.enums.employee_status} value={data.user.employeeStatus} />
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" href="/users/{data.user.id}/edit">
				<Pencil class="mr-2 h-4 w-4" />
				Edit
			</Button>
			{#if !data.isSelf}
				<Button variant="destructive" onclick={() => (deleteDialogOpen = true)}>
					<Trash2 class="mr-2 h-4 w-4" />
					Delete
				</Button>
			{/if}
		</div>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
		<div class="rounded-lg border bg-card p-4 text-center">
			<div class="flex items-center justify-center gap-2 text-muted-foreground mb-1">
				<FolderKanban class="h-4 w-4" />
				<span class="text-sm">Projects</span>
			</div>
			<p class="text-2xl font-bold">{data.user._count.assignedProjects}</p>
		</div>
		<div class="rounded-lg border bg-card p-4 text-center">
			<div class="flex items-center justify-center gap-2 text-muted-foreground mb-1">
				<Briefcase class="h-4 w-4" />
				<span class="text-sm">Managed</span>
			</div>
			<p class="text-2xl font-bold">{data.user._count.managedProjects}</p>
		</div>
		<div class="rounded-lg border bg-card p-4 text-center">
			<div class="flex items-center justify-center gap-2 text-muted-foreground mb-1">
				<ListChecks class="h-4 w-4" />
				<span class="text-sm">Tasks</span>
			</div>
			<p class="text-2xl font-bold">{data.user._count.assignedTasks}</p>
		</div>
		<div class="rounded-lg border bg-card p-4 text-center">
			<div class="flex items-center justify-center gap-2 text-muted-foreground mb-1">
				<Clock class="h-4 w-4" />
				<span class="text-sm">Time Records</span>
			</div>
			<p class="text-2xl font-bold">{data.user._count.performedTimeRecords}</p>
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Left column: Contact & Personal Info -->
		<div class="space-y-6">
			<!-- Contact Info -->
			<div class="rounded-lg border bg-card">
				<div class="border-b p-4">
					<h2 class="font-semibold">Contact Information</h2>
				</div>
				<div class="p-4 space-y-3">
					<div class="flex items-center gap-3 text-sm">
						<Mail class="h-4 w-4 text-muted-foreground shrink-0" />
						<a href="mailto:{data.user.email}" class="text-primary hover:underline">{data.user.email}</a>
					</div>
					{#if data.user.phone}
						<div class="flex items-center gap-3 text-sm">
							<Phone class="h-4 w-4 text-muted-foreground shrink-0" />
							<span>{data.user.phone}</span>
						</div>
					{/if}
					{#if data.user.mobile}
						<div class="flex items-center gap-3 text-sm">
							<Smartphone class="h-4 w-4 text-muted-foreground shrink-0" />
							<span>{data.user.mobile}</span>
						</div>
					{/if}
					{#if data.user.street || data.user.city}
						<div class="flex items-start gap-3 text-sm">
							<MapPin class="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
							<div>
								{#if data.user.street}<div>{data.user.street}</div>{/if}
								{#if data.user.city || data.user.postalCode}
									<div>{[data.user.postalCode, data.user.city].filter(Boolean).join(' ')}</div>
								{/if}
								{#if data.user.country}<div>{data.user.country}</div>{/if}
							</div>
						</div>
					{/if}
					{#if data.user.emergencyContact}
						<div class="pt-2 border-t">
							<p class="text-xs text-muted-foreground mb-1">Emergency Contact</p>
							<p class="text-sm">{data.user.emergencyContact}</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Personal Info -->
			<div class="rounded-lg border bg-card">
				<div class="border-b p-4">
					<h2 class="font-semibold">Personal Details</h2>
				</div>
				<div class="p-4 space-y-3">
					{#if data.user.dateOfBirth}
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Date of Birth</span>
							<span>{formatDate(data.user.dateOfBirth)}</span>
						</div>
					{/if}
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Account Name</span>
						<span>{data.user.name}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-muted-foreground">Joined</span>
						<span>{formatDate(data.user.createdAt)}</span>
					</div>
				</div>
			</div>

			<!-- Groups & Permissions -->
			<div class="rounded-lg border bg-card">
				<div class="border-b p-4">
					<h2 class="font-semibold flex items-center gap-2">
						<Shield class="h-4 w-4" />
						Groups & Permissions
					</h2>
				</div>
				<div class="p-4">
					{#if data.user.groups.length > 0}
						<div class="flex flex-wrap gap-2">
							{#each data.user.groups as group}
								<Badge variant="secondary">{group.name}</Badge>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-muted-foreground">No groups assigned</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- Middle column: Employment Info -->
		<div class="space-y-6">
			<!-- Employment -->
			<div class="rounded-lg border bg-card">
				<div class="border-b p-4">
					<h2 class="font-semibold flex items-center gap-2">
						<Building2 class="h-4 w-4" />
						Employment
					</h2>
				</div>
				<div class="p-4 space-y-3">
					{#if data.user.jobTitle}
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Job Title</span>
							<span>{data.user.jobTitle}</span>
						</div>
					{/if}
					{#if data.user.department}
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Department</span>
							<EnumBadge enums={data.enums.department} value={data.user.department} />
						</div>
					{/if}
					{#if data.user.employmentType}
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Employment Type</span>
							<EnumBadge enums={data.enums.employment_type} value={data.user.employmentType} />
						</div>
					{/if}
					{#if data.user.company}
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Company</span>
							<span>{data.user.company.name}</span>
						</div>
					{/if}
					{#if data.user.hireDate}
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Hire Date</span>
							<span>{formatDate(data.user.hireDate)}</span>
						</div>
					{/if}
					{#if !data.user.jobTitle && !data.user.department && !data.user.employmentType && !data.user.hireDate}
						<p class="text-sm text-muted-foreground">No employment details set</p>
					{/if}
				</div>
			</div>

			<!-- Salary (permission-gated) -->
			{#if data.canViewSalary}
				<div class="rounded-lg border bg-card">
					<div class="border-b p-4">
						<h2 class="font-semibold">Compensation</h2>
					</div>
					<div class="p-4 space-y-3">
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Salary</span>
							<span class="font-medium">{formatCurrency(data.user.salary)}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Tax</span>
							<span>{formatCurrency(data.user.salary_tax)}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-muted-foreground">Bonus</span>
							<span>{formatCurrency(data.user.salary_bonus)}</span>
						</div>
					</div>
				</div>
			{/if}

			<!-- Notes -->
			{#if data.user.notes}
				<div class="rounded-lg border bg-card">
					<div class="border-b p-4">
						<h2 class="font-semibold">Notes</h2>
					</div>
					<div class="p-4">
						<p class="text-sm whitespace-pre-wrap">{data.user.notes}</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Right column: Projects & Tasks -->
		<div class="space-y-6">
			<!-- Managed Projects -->
			{#if data.user.managedProjects.length > 0}
				<div class="rounded-lg border bg-card">
					<div class="border-b p-4">
						<h2 class="font-semibold">Managed Projects</h2>
					</div>
					<div class="divide-y">
						{#each data.user.managedProjects as project}
							<a href="/projects/{project.id}" class="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
								<span class="text-sm font-medium">{project.name}</span>
								<EnumBadge enums={data.enums.project_status} value={project.status} />
							</a>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Assigned Projects -->
			{#if data.user.assignedProjects.length > 0}
				<div class="rounded-lg border bg-card">
					<div class="border-b p-4 flex items-center justify-between">
						<h2 class="font-semibold">Assigned Projects</h2>
						<span class="text-sm text-muted-foreground">{data.user._count.assignedProjects} total</span>
					</div>
					<div class="divide-y">
						{#each data.user.assignedProjects as project}
							<a href="/projects/{project.id}" class="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
								<span class="text-sm font-medium">{project.name}</span>
								<div class="flex items-center gap-2">
									{#if project.role}
										<Badge variant="outline" class="text-xs">{project.role}</Badge>
									{/if}
									<EnumBadge enums={data.enums.project_status} value={project.status} />
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Active Tasks -->
			{#if data.user.assignedTasks.length > 0}
				<div class="rounded-lg border bg-card">
					<div class="border-b p-4 flex items-center justify-between">
						<h2 class="font-semibold">Active Tasks</h2>
						<span class="text-sm text-muted-foreground">{data.user._count.assignedTasks} total</span>
					</div>
					<div class="divide-y">
						{#each data.user.assignedTasks as task}
							<a href="/projects/{task.project.id}" class="block p-3 hover:bg-muted/50 transition-colors">
								<div class="flex items-center justify-between">
									<span class="text-sm font-medium">{task.name}</span>
									<EnumBadge enums={data.enums.priority} value={task.priority} />
								</div>
								<div class="flex items-center gap-2 mt-1">
									<span class="text-xs text-muted-foreground">{task.project.name}</span>
									{#if task.dueDate}
										<span class="text-xs text-muted-foreground flex items-center gap-1">
											<Calendar class="h-3 w-3" />
											{formatDate(task.dueDate)}
										</span>
									{/if}
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}

			{#if data.user.managedProjects.length === 0 && data.user.assignedProjects.length === 0 && data.user.assignedTasks.length === 0}
				<div class="rounded-lg border bg-card p-6 text-center">
					<p class="text-muted-foreground text-sm">No projects or tasks assigned</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete User</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{getDisplayName(data.user)}</strong>? This action cannot be undone. All project assignments, time records, and other data linked to this user will be affected.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				onclick={handleDelete}
				disabled={isDeleting}
			>
				{isDeleting ? 'Deleting...' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
