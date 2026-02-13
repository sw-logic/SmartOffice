<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import UserAvatar from '$lib/components/shared/UserAvatar.svelte';
	import MilestoneFormModal from '$lib/components/shared/MilestoneFormModal.svelte';
	import MarkdownViewer from '$lib/components/shared/MarkdownViewer.svelte';
	import Metric from '$lib/components/shared/Metric.svelte';
	import EnumBadge from '$lib/components/shared/EnumBadge.svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import {
		ArrowLeft,
		Pencil,
		Calendar,
		DollarSign,
		Briefcase,
		Users,
		ListChecks,
		ExternalLink,
		Milestone,
		Kanban,
		Clock,
		Plus,
		Trash2,
		Check,
		ChevronsUpDown
	} from 'lucide-svelte';
	import { formatDate } from '$lib/utils/date';
	import { createCurrencyFormatter } from '$lib/utils/currency';

	let { data } = $props();

	const fmt = createCurrencyFormatter(data.enums.currency);

	// Team management state
	let teamPopoverOpen = $state(false);
	let teamSearchQuery = $state('');
	let isUpdatingTeam = $state(false);

	let selectedPersonIds = $derived(
		new Set(data.project.assignedEmployees.map((a: { user: { id: number } }) => a.user.id))
	);

	let filteredEmployees = $derived(
		data.allEmployees.filter((emp: { firstName: string | null; lastName: string | null }) => {
			if (!teamSearchQuery) return true;
			const q = teamSearchQuery.toLowerCase();
			return `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.toLowerCase().includes(q);
		})
	);

	async function toggleTeamMember(personId: number) {
		if (isUpdatingTeam) return;
		isUpdatingTeam = true;

		const newIds = new Set(selectedPersonIds);
		if (newIds.has(personId)) {
			newIds.delete(personId);
		} else {
			newIds.add(personId);
		}

		const formData = new FormData();
		formData.set('userIds', JSON.stringify([...newIds]));

		try {
			const response = await fetch(`?/updateTeam`, {
				method: 'POST',
				body: formData
			});
			const result = await response.json();

			if (result.type === 'success') {
				toast.success('Team updated');
				await invalidateAll();
			} else {
				toast.error(result.data?.error || 'Failed to update team');
			}
		} catch {
			toast.error('Failed to update team');
		} finally {
			isUpdatingTeam = false;
		}
	}

	// Milestone management state
	let milestoneModalOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let milestoneToDelete = $state<{ id: number; name: string } | null>(null);
	let isDeletingMilestone = $state(false);

	async function handleCreateMilestone(milestone: { name: string; description: string; date: string }): Promise<{ success: boolean; error?: string }> {
		const formData = new FormData();
		formData.set('name', milestone.name);
		formData.set('description', milestone.description);
		formData.set('date', milestone.date);

		try {
			const response = await fetch(`?/createMilestone`, {
				method: 'POST',
				body: formData
			});
			const result = await response.json();

			if (result.type === 'success') {
				toast.success('Milestone created');
				await invalidateAll();
				return { success: true };
			}
			return { success: false, error: result.data?.error || 'Failed to create milestone' };
		} catch {
			return { success: false, error: 'An unexpected error occurred' };
		}
	}

	function confirmDeleteMilestone(milestone: { id: number; name: string }) {
		milestoneToDelete = milestone;
		deleteDialogOpen = true;
	}

	async function handleDeleteMilestone() {
		if (!milestoneToDelete) return;
		isDeletingMilestone = true;

		const formData = new FormData();
		formData.set('milestoneId', String(milestoneToDelete.id));

		try {
			const response = await fetch(`?/deleteMilestone`, {
				method: 'POST',
				body: formData
			});
			const result = await response.json();

			if (result.type === 'success') {
				toast.success('Milestone deleted');
				await invalidateAll();
			} else {
				toast.error(result.data?.error || 'Failed to delete milestone');
			}
		} catch {
			toast.error('Failed to delete milestone');
		} finally {
			isDeletingMilestone = false;
			deleteDialogOpen = false;
			milestoneToDelete = null;
		}
	}



</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" href="/projects">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-3xl font-bold tracking-tight">{data.project.name}</h1>
					<EnumBadge enums={data.enums.project_status} value={data.project.status} />
					<EnumBadge enums={data.enums.priority} value={data.project.priority} />
				</div>
				<p class="text-muted-foreground flex items-center gap-1">
					<Briefcase class="h-4 w-4" />
					<a href="/clients/{data.project.client.id}" class="text-primary hover:underline">
						{data.project.client.name}
					</a>
				</p>
			</div>
		</div>
		<Button href="/projects/{data.project.id}/edit">
			<Pencil class="mr-2 h-4 w-4" />
			Edit Project
		</Button>
	</div>


	<div class="grid gap-6 md:grid-cols-3">
		<!-- Main Info Card -->
		<Card.Root class="md:col-span-2">
			<Card.Header>
				<Card.Title>Project Details</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="flex items-center gap-3">
						<Briefcase class="h-4 w-4 text-muted-foreground" />
						<div>
							<p class="text-sm text-muted-foreground">Client</p>
							<a href="/clients/{data.project.client.id}" class="text-primary hover:underline flex items-center gap-1">
								{data.project.client.name}
								<ExternalLink class="h-3 w-3" />
							</a>
						</div>
					</div>

					{#if data.project.projectManager}
						<div class="flex items-center gap-3">
							<UserAvatar user={data.project.projectManager} size="lg" />
							<div>
								<p class="text-sm text-muted-foreground">Project Manager</p>
								<p>{data.project.projectManager.firstName ?? ''} {data.project.projectManager.lastName ?? ''}</p>
							</div>
						</div>
					{/if}

					{#if data.project.startDate}
						<div class="flex items-center gap-3">
							<Calendar class="h-4 w-4 text-muted-foreground" />
							<div>
								<p class="text-sm text-muted-foreground">Start Date</p>
								<p>{formatDate(data.project.startDate)}</p>
							</div>
						</div>
					{/if}

					{#if data.project.endDate}
						<div class="flex items-center gap-3">
							<Calendar class="h-4 w-4 text-muted-foreground" />
							<div>
								<p class="text-sm text-muted-foreground">End Date</p>
								<p>{formatDate(data.project.endDate)}</p>
							</div>
						</div>
					{/if}
				</div>

				{#if data.project.description}
					<div class="pt-4 border-t">
						<p class="text-sm text-muted-foreground mb-1">Description</p>
						<MarkdownViewer value={data.project.description} />
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
					<Metric icon={Milestone} title="Milestones" value={data.project._count.milestones} />
					<Metric icon={Kanban} title="Boards" value={data.project._count.kanbanBoards} />
					<Metric icon={ListChecks} title="Tasks" value={data.project._count.tasks} />
				</div>

				<!-- Team Members section -->
				<div class="pt-4 border-t space-y-2">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2 text-muted-foreground">
							<Users class="h-4 w-4" />
							<span>Team Members</span>
						</div>
						{#if data.canManageProject}
							<Popover.Root bind:open={teamPopoverOpen}>
								<Popover.Trigger>
									<Button variant="outline" size="sm" class="h-7 gap-1">
										<ChevronsUpDown class="h-3 w-3" />
										Manage
									</Button>
								</Popover.Trigger>
								<Popover.Content class="w-64 p-0" align="end">
									<Command.Root>
										<Command.Input
											placeholder="Search employees..."
											bind:value={teamSearchQuery}
										/>
										<Command.List>
											<Command.Empty>No employees found.</Command.Empty>
											<Command.Group>
												{#each filteredEmployees as employee (employee.id)}
													<Command.Item
														value="{employee.firstName} {employee.lastName}"
														onSelect={() => toggleTeamMember(employee.id)}
													>
														<div class="flex items-center gap-2 w-full">
															<Checkbox
																checked={selectedPersonIds.has(employee.id)}
																disabled={isUpdatingTeam}
															/>
															<UserAvatar user={employee} size="sm" class="shrink-0" />
															<div class="flex-1 min-w-0">
																<p class="text-sm truncate">
																	{employee.firstName} {employee.lastName}
																</p>
																{#if employee.jobTitle}
																	<p class="text-xs text-muted-foreground truncate">{employee.jobTitle}</p>
																{/if}
															</div>
															{#if selectedPersonIds.has(employee.id)}
																<Check class="h-4 w-4 text-primary shrink-0" />
															{/if}
														</div>
													</Command.Item>
												{/each}
											</Command.Group>
										</Command.List>
									</Command.Root>
								</Popover.Content>
							</Popover.Root>
						{/if}
					</div>
					{#if data.project.assignedEmployees.length === 0}
						<p class="text-sm text-muted-foreground">No team members assigned</p>
					{:else}
						<div class="space-y-2">
							{#each data.project.assignedEmployees as assignment}
								<div class="flex items-center gap-2">
									<UserAvatar user={assignment.user} size="sm" />
									<span class="text-sm">
										{assignment.user.firstName ?? ''} {assignment.user.lastName ?? ''}
										{#if assignment.role}
											<span class="text-muted-foreground">({assignment.role})</span>
										{/if}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="pt-4 border-t space-y-3">
					{#if data.canViewBudget && data.project.budgetEstimate}
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2 text-muted-foreground">
								<DollarSign class="h-4 w-4" />
								<span>Budget</span>
							</div>
							<span class="font-semibold">
								{fmt.format(data.project.budgetEstimate)}
							</span>
						</div>
					{/if}

					{#if data.project.estimatedHours}
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2 text-muted-foreground">
								<Clock class="h-4 w-4" />
								<span>Est. Hours</span>
							</div>
							<span class="font-semibold">{data.project.estimatedHours}h</span>
						</div>
					{/if}

					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2 text-muted-foreground">
							<Clock class="h-4 w-4" />
							<span>Spent Time</span>
						</div>
						<span class="font-semibold">{Math.floor(data.project.spentMinutes / 60)}h {data.project.spentMinutes % 60}m</span>
					</div>

					{#if data.canViewBudget}
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2 text-muted-foreground">
								<DollarSign class="h-4 w-4" />
								<span>Total Income</span>
							</div>
							<span class="font-semibold text-green-600">
								{fmt.format(data.project.totalIncome)}
							</span>
						</div>

						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2 text-muted-foreground">
								<DollarSign class="h-4 w-4" />
								<span>Total Expenses</span>
							</div>
							<span class="font-semibold text-red-600">
								{fmt.format(data.project.totalExpenses)}
							</span>
						</div>
					{/if}
				</div>

				<div class="pt-4 border-t text-sm text-muted-foreground">
					<div class="flex items-center gap-1">
						<Calendar class="h-3 w-3" />
						Created {formatDate(data.project.createdAt)}
					</div>
					<div class="mt-1">
						by {data.project.createdBy.name}
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Tabs for related data -->
	<Tabs.Root value="milestones" class="w-full">
		<Tabs.List>
			<Tabs.Trigger value="milestones">
				Milestones ({data.project._count.milestones})
			</Tabs.Trigger>
			<Tabs.Trigger value="boards">
				Boards ({data.project._count.kanbanBoards})
			</Tabs.Trigger>
			<Tabs.Trigger value="tasks">
				Tasks ({data.project._count.tasks})
			</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="milestones" class="mt-4">
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between">
					<Card.Title>Milestones</Card.Title>
					{#if data.canManageProject}
						<Button size="sm" onclick={() => milestoneModalOpen = true}>
							<Plus class="mr-1 h-4 w-4" />
							New Milestone
						</Button>
					{/if}
				</Card.Header>
				<Card.Content>
					{#if data.project.milestones.length === 0}
						<p class="text-muted-foreground text-center py-8">No milestones defined yet.</p>
					{:else}
						<div class="space-y-3">
							{#each data.project.milestones as milestone}
								<div class="flex items-center justify-between p-3 rounded-lg border">
									<div class="flex-1">
										<div class="flex items-center gap-2">
											<p class="font-medium">{milestone.name}</p>
											{#if milestone.completed}
												<Badge variant="default">Completed</Badge>
											{:else}
												<Badge variant="outline">Pending</Badge>
											{/if}
										</div>
										{#if milestone.description}
											<p class="text-sm text-muted-foreground mt-1">{milestone.description}</p>
										{/if}
									</div>
									<div class="flex items-center gap-2">
										<span class="text-sm text-muted-foreground">
											{formatDate(milestone.date)}
										</span>
										{#if data.canManageProject}
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8 text-muted-foreground hover:text-destructive"
												onclick={() => confirmDeleteMilestone(milestone)}
											>
												<Trash2 class="h-4 w-4" />
											</Button>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="tasks" class="mt-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>Recent Tasks</Card.Title>
				</Card.Header>
				<Card.Content>
					{#if data.project.tasks.length === 0}
						<p class="text-muted-foreground text-center py-8">No tasks created yet.</p>
					{:else}
						<div class="space-y-3">
							{#each data.project.tasks as task}
								<div class="flex items-center justify-between p-3 rounded-lg border">
									<div class="flex-1">
										<p class="font-medium">{task.name}</p>
										<div class="flex items-center gap-2 mt-1">
											{#if task.assignedTo}
												<UserAvatar user={task.assignedTo} size="xs" />
												<span class="text-sm text-muted-foreground">
													{task.assignedTo.firstName} {task.assignedTo.lastName}
												</span>
											{/if}
											{#if task.dueDate}
												<span class="text-sm text-muted-foreground">
													Due: {formatDate(task.dueDate)}
												</span>
											{/if}
										</div>
									</div>
									<div class="flex items-center gap-2">
										<EnumBadge enums={data.enums.priority} value={task.priority} />
										<EnumBadge enums={data.enums.task_status} value={task.status} />
									</div>
								</div>
							{/each}
						</div>
						{#if data.project._count.tasks > 5}
							<div class="mt-4 text-center">
								<p class="text-sm text-muted-foreground">
									Showing 5 of {data.project._count.tasks} tasks
								</p>
							</div>
						{/if}
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="boards" class="mt-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>Kanban Boards</Card.Title>
				</Card.Header>
				<Card.Content>
					{#if data.project.kanbanBoards.length === 0}
						<p class="text-muted-foreground text-center py-8">No kanban boards created yet.</p>
					{:else}
						<div class="space-y-3">
							{#each data.project.kanbanBoards as board}
								<div class="flex items-center justify-between p-3 rounded-lg border">
									<div class="flex-1">
										<p class="font-medium">{board.name}</p>
										{#if board.description}
											<p class="text-sm text-muted-foreground mt-1">{board.description}</p>
										{/if}
									</div>
									<div class="flex items-center gap-3 text-sm text-muted-foreground">
										<span class="flex items-center gap-1" title="Members">
											<Users class="h-3 w-3" />
											{board._count.members}
										</span>
										<span class="flex items-center gap-1" title="Tasks">
											<ListChecks class="h-3 w-3" />
											{board._count.tasks}
										</span>
									</div>
								</div>
							{/each}
						</div>
						{#if data.project._count.kanbanBoards > 5}
							<div class="mt-4 text-center">
								<p class="text-sm text-muted-foreground">
									Showing 5 of {data.project._count.kanbanBoards} boards
								</p>
							</div>
						{/if}
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>

<!-- Milestone Form Modal -->
<MilestoneFormModal
	bind:open={milestoneModalOpen}
	onOpenChange={(v) => milestoneModalOpen = v}
	onSubmit={handleCreateMilestone}
/>

<!-- Delete Milestone Confirmation -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Milestone</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete <strong>{milestoneToDelete?.name}</strong>? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				onclick={handleDeleteMilestone}
				disabled={isDeletingMilestone}
			>
				{isDeletingMilestone ? 'Deleting...' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
