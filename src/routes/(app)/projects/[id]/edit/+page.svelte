<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import MarkdownEditor from '$lib/components/shared/MarkdownEditor.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import * as Alert from '$lib/components/ui/alert';
	import { ArrowLeft, AlertTriangle } from 'lucide-svelte';

	let { data, form } = $props();

	let isSubmitting = $state(false);

	const defaultStatus = data.enums.project_status.find((s) => s.isDefault)?.value || 'planning';
	const defaultPriority = data.enums.priority.find((p) => p.isDefault)?.value || 'medium';

	let selectedStatus = $state(form?.values?.status || data.project.status || defaultStatus);
	let selectedPriority = $state(form?.values?.priority || data.project.priority || defaultPriority);
	let selectedClientId = $state(form?.values?.clientId || String(data.project.clientId) || '');
	let selectedProjectManagerId = $state(
		form?.values?.projectManagerId || (data.project.projectManagerId ? String(data.project.projectManagerId) : '')
	);
	let description = $state(form?.values?.description || data.project.description || '');

	function formatDateForInput(date: string | Date | null): string {
		if (!date) return '';
		const d = new Date(date);
		return d.toISOString().split('T')[0];
	}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/projects/{data.project.id}">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Edit Project</h1>
			<p class="text-muted-foreground">Update project information</p>
		</div>
	</div>

	{#if data.project.isDeleted}
		<Alert.Root variant="destructive" class="max-w-2xl">
			<AlertTriangle class="h-4 w-4" />
			<Alert.Title>Deleted Project</Alert.Title>
			<Alert.Description>
				This project has been deleted. You can edit its details, but it won't appear in normal lists until restored.
			</Alert.Description>
		</Alert.Root>
	{/if}

	<form
		method="POST"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ update }) => {
				await update();
				isSubmitting = false;
			};
		}}
		class="space-y-6"
	>
		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Basic Information</Card.Title>
				<Card.Description>Update the project's basic details</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="name">Project Name *</Label>
					<Input
						id="name"
						name="name"
						placeholder="Enter project name"
						value={form?.values?.name || data.project.name}
						required
					/>
					{#if form?.errors?.name}
						<p class="text-sm text-destructive">{form.errors.name}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="description">Description</Label>
					<MarkdownEditor
						bind:value={description}
						placeholder="Project description..."
					/>
					<input type="hidden" name="description" value={description} />
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="clientId">Client *</Label>
						<Select.Root type="single" bind:value={selectedClientId} name="clientId">
							<Select.Trigger>
								{data.clients.find((c) => String(c.id) === selectedClientId)?.name || 'Select client'}
							</Select.Trigger>
							<Select.Content>
								{#each data.clients as client}
									<Select.Item value={String(client.id)}>{client.name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="clientId" value={selectedClientId} />
						{#if form?.errors?.clientId}
							<p class="text-sm text-destructive">{form.errors.clientId}</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="projectManagerId">Project Manager</Label>
						<Select.Root type="single" bind:value={selectedProjectManagerId} name="projectManagerId">
							<Select.Trigger>
								{data.persons.find((p) => String(p.id) === selectedProjectManagerId)
									? `${data.persons.find((p) => String(p.id) === selectedProjectManagerId)!.firstName} ${data.persons.find((p) => String(p.id) === selectedProjectManagerId)!.lastName}`
									: 'Select manager'}
							</Select.Trigger>
							<Select.Content>
								{#each data.persons as person}
									<Select.Item value={String(person.id)}>
										{person.firstName} {person.lastName}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="projectManagerId" value={selectedProjectManagerId} />
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="status">Status</Label>
						<Select.Root type="single" bind:value={selectedStatus} name="status">
							<Select.Trigger>
								{data.enums.project_status.find((s) => s.value === selectedStatus)?.label || 'Select status'}
							</Select.Trigger>
							<Select.Content>
								{#each data.enums.project_status as status}
									<Select.Item value={status.value}>{status.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="status" value={selectedStatus} />
					</div>

					<div class="space-y-2">
						<Label for="priority">Priority</Label>
						<Select.Root type="single" bind:value={selectedPriority} name="priority">
							<Select.Trigger>
								{data.enums.priority.find((p) => p.value === selectedPriority)?.label || 'Select priority'}
							</Select.Trigger>
							<Select.Content>
								{#each data.enums.priority as priority}
									<Select.Item value={priority.value}>{priority.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="priority" value={selectedPriority} />
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Schedule</Card.Title>
				<Card.Description>Project timeline</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="startDate">Start Date</Label>
						<Input
							id="startDate"
							name="startDate"
							type="date"
							value={form?.values?.startDate || formatDateForInput(data.project.startDate)}
						/>
					</div>

					<div class="space-y-2">
						<Label for="endDate">End Date</Label>
						<Input
							id="endDate"
							name="endDate"
							type="date"
							value={form?.values?.endDate || formatDateForInput(data.project.endDate)}
						/>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		{#if data.canViewBudget}
			<Card.Root class="max-w-2xl">
				<Card.Header>
					<Card.Title>Budget & Estimates</Card.Title>
					<Card.Description>Financial estimates for this project</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="budgetEstimate">Budget Estimate</Label>
							<Input
								id="budgetEstimate"
								name="budgetEstimate"
								type="number"
								step="0.01"
								min="0"
								placeholder="0.00"
								value={form?.values?.budgetEstimate || data.project.budgetEstimate || ''}
							/>
						</div>

						<div class="space-y-2">
							<Label for="estimatedHours">Estimated Hours</Label>
							<Input
								id="estimatedHours"
								name="estimatedHours"
								type="number"
								step="0.5"
								min="0"
								placeholder="0"
								value={form?.values?.estimatedHours || data.project.estimatedHours || ''}
							/>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

		<div class="flex gap-4 max-w-2xl">
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Saving...' : 'Save Changes'}
			</Button>
			<Button type="button" variant="outline" href="/projects/{data.project.id}">Cancel</Button>
		</div>
	</form>
</div>
