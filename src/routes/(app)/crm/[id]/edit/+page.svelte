<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import MarkdownEditor from '$lib/components/shared/MarkdownEditor.svelte';
	import DurationInput from '$lib/components/shared/DurationInput.svelte';
	import { LEAD_STAGES } from '$lib/config/lead-stages';
	import { ArrowLeft } from 'lucide-svelte';

	let { data, form } = $props();

	let isSubmitting = $state(false);
	let description = $state(data.lead.description || '');

	// Format date for input[type=date]
	function toDateStr(val: string | Date | null): string {
		if (!val) return '';
		const d = new Date(val);
		return d.toISOString().split('T')[0];
	}

	// Select state
	let selectedClientId = $state(data.lead.clientId ? String(data.lead.clientId) : '');
	let selectedContactId = $state(data.lead.contactId ? String(data.lead.contactId) : '');
	let selectedAssignedToId = $state(data.lead.assignedToId ? String(data.lead.assignedToId) : '');
	let selectedSource = $state(data.lead.source || '');
	let selectedStage = $state(data.lead.stage);
	let selectedCurrency = $state(data.lead.currency || 'HUF');
	let estimatedHours = $state<number | null>(
		data.lead.estimatedHours ?? null
	);

	// Client→Contact cascade
	let filteredContacts = $derived(
		selectedClientId
			? data.clients.find((c) => String(c.id) === selectedClientId)?.contacts || []
			: []
	);

	function handleClientChange(value: string | undefined) {
		selectedClientId = value || '';
		selectedContactId = ''; // Reset contact when client changes
	}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/crm/{data.lead.id}">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Edit Lead</h1>
			<p class="text-muted-foreground">Update lead details</p>
		</div>
	</div>

	{#if form?.error}
		<div class="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
			{form.error}
		</div>
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
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="title">Lead Title *</Label>
						<Input
							id="title"
							name="title"
							placeholder="Enter lead title"
							value={data.lead.title}
							required
						/>
					</div>

					<div class="space-y-2">
						<Label for="stage">Stage</Label>
						<Select.Root type="single" value={selectedStage} onValueChange={(v) => { if (v) selectedStage = v; }}>
							<Select.Trigger id="stage" class="w-full">
								{LEAD_STAGES.find((s) => s.value === selectedStage)?.label || 'Select stage'}
							</Select.Trigger>
							<Select.Content>
								{#each LEAD_STAGES as stage}
									<Select.Item value={stage.value}>
										<span class="flex items-center gap-2">
											<span class="w-2 h-2 rounded-full" style="background-color: {stage.color}"></span>
											{stage.label}
										</span>
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="stage" value={selectedStage} />
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="source">Source</Label>
						<Select.Root type="single" value={selectedSource} onValueChange={(v) => { if (v) selectedSource = v; }}>
							<Select.Trigger id="source" class="w-full">
								{data.enums.lead_source?.find((s) => s.value === selectedSource)?.label || 'Select source'}
							</Select.Trigger>
							<Select.Content>
								{#each data.enums.lead_source || [] as source}
									<Select.Item value={source.value}>{source.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="source" value={selectedSource} />
					</div>

					<div class="space-y-2">
						<Label for="assignedToId">Assigned To</Label>
						<Select.Root type="single" value={selectedAssignedToId} onValueChange={(v) => { if (v) selectedAssignedToId = v; }}>
							<Select.Trigger id="assignedToId" class="w-full">
								{data.employees.find((e) => String(e.id) === selectedAssignedToId)?.name || 'Select employee'}
							</Select.Trigger>
							<Select.Content>
								{#each data.employees as employee}
									<Select.Item value={String(employee.id)}>{employee.name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="assignedToId" value={selectedAssignedToId} />
					</div>
				</div>

				<div class="space-y-2">
					<Label>Description</Label>
					<MarkdownEditor bind:value={description} placeholder="Describe the lead..." />
					<input type="hidden" name="description" value={description} />
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Client & Contact</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="clientId">Client</Label>
						<Select.Root type="single" value={selectedClientId} onValueChange={handleClientChange}>
							<Select.Trigger id="clientId" class="w-full">
								{data.clients.find((c) => String(c.id) === selectedClientId)?.name || 'Select client'}
							</Select.Trigger>
							<Select.Content>
								{#each data.clients as client}
									<Select.Item value={String(client.id)}>{client.name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="clientId" value={selectedClientId} />
					</div>

					<div class="space-y-2">
						<Label for="contactId">Contact</Label>
						<Select.Root type="single" value={selectedContactId} onValueChange={(v) => { if (v) selectedContactId = v; }} disabled={!selectedClientId}>
							<Select.Trigger id="contactId" class="w-full">
								{#if !selectedClientId}
									Select client first
								{:else}
									{@const contact = filteredContacts.find((c) => String(c.id) === selectedContactId)}
									{contact ? `${contact.firstName} ${contact.lastName}` : 'Select contact'}
								{/if}
							</Select.Trigger>
							<Select.Content>
								{#each filteredContacts as contact}
									<Select.Item value={String(contact.id)}>
										{contact.firstName} {contact.lastName}
										{#if contact.position}
											<span class="text-muted-foreground ml-1">({contact.position})</span>
										{/if}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="contactId" value={selectedContactId} />
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Financial & Timeline</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="budget">Budget</Label>
						<Input
							id="budget"
							name="budget"
							type="number"
							step="0.01"
							min="0"
							placeholder="0.00"
							value={data.lead.budget ?? ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="currency">Currency</Label>
						<Select.Root type="single" value={selectedCurrency} onValueChange={(v) => { if (v) selectedCurrency = v; }}>
							<Select.Trigger id="currency" class="w-full">
								{data.enums.currency.find((c) => c.value === selectedCurrency)?.label || selectedCurrency}
							</Select.Trigger>
							<Select.Content>
								{#each data.enums.currency as currency}
									<Select.Item value={currency.value}>{currency.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="currency" value={selectedCurrency} />
					</div>
				</div>

				<div class="space-y-2">
					<Label for="estimatedHours">Estimated Time</Label>
					<DurationInput
						id="estimatedHours"
						name="estimatedHours"
						value={estimatedHours}
						onchange={(v) => (estimatedHours = v)}
						placeholder="e.g. 2w 3d or 40h"
					/>
					<input type="hidden" name="estimatedHours" value={estimatedHours ?? ''} />
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="offerDueDate">Offer Due Date</Label>
						<Input
							id="offerDueDate"
							name="offerDueDate"
							type="date"
							value={toDateStr(data.lead.offerDueDate)}
						/>
					</div>

					<div class="space-y-2">
						<Label for="deadline">Deadline</Label>
						<Input
							id="deadline"
							name="deadline"
							type="date"
							value={toDateStr(data.lead.deadline)}
						/>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<div class="flex gap-4 max-w-2xl">
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Saving...' : 'Save Changes'}
			</Button>
			<Button type="button" variant="outline" href="/crm/{data.lead.id}">Cancel</Button>
		</div>
	</form>
</div>
