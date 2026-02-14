<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import MarkdownEditor from '$lib/components/shared/MarkdownEditor.svelte';
	import DurationInput from '$lib/components/shared/DurationInput.svelte';
	import { ArrowLeft } from 'lucide-svelte';

	let { data, form } = $props();

	let isSubmitting = $state(false);
	let description = $state(form?.values?.description || '');

	// Select state
	let selectedClientId = $state(data.preselectedClientId || form?.values?.clientId || '');
	let selectedContactId = $state(form?.values?.contactId || '');
	let selectedAssignedToId = $state(form?.values?.assignedToId || '');
	let selectedType = $state(form?.values?.type || '');
	let selectedStatus = $state(form?.values?.status || 'active');
	let selectedCurrency = $state(form?.values?.currency || 'HUF');
	let selectedPeriod = $state(form?.values?.recurringPeriod || 'monthly');
	let budgetedHours = $state<number | null>(
		form?.values?.budgetedHours ? Number(form.values.budgetedHours) : null
	);

	let feeLabel = $derived(
		data.enums.recurring_period?.find((p) => p.value === selectedPeriod)?.label ?? 'Monthly'
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
		<Button variant="ghost" size="icon" href="/services">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<div>
			<h1 class="text-3xl font-bold tracking-tight">New Service</h1>
			<p class="text-muted-foreground">Add a new recurring service</p>
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
				<div class="space-y-2">
					<Label for="name">Service Name *</Label>
					<Input
						id="name"
						name="name"
						placeholder="Enter service name"
						value={form?.values?.name || ''}
						required
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="type">Type</Label>
						<Select.Root type="single" value={selectedType || 'none'} onValueChange={(v) => { selectedType = v === 'none' ? '' : v; }}>
							<Select.Trigger id="type" class="w-full">
								{data.enums.service_type?.find((t) => t.value === selectedType)?.label || 'Select type'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="none">Select type</Select.Item>
								{#each data.enums.service_type || [] as type}
									<Select.Item value={type.value}>{type.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="type" value={selectedType} />
					</div>

					<div class="space-y-2">
						<Label for="status">Status</Label>
						<Select.Root type="single" value={selectedStatus} onValueChange={(v) => { if (v) selectedStatus = v; }}>
							<Select.Trigger id="status" class="w-full">
								{data.enums.service_status?.find((s) => s.value === selectedStatus)?.label || selectedStatus}
							</Select.Trigger>
							<Select.Content>
								{#each data.enums.service_status || [] as status}
									<Select.Item value={status.value}>{status.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="status" value={selectedStatus} />
					</div>
				</div>

				<div class="space-y-2">
					<Label for="assignedToId">Assigned To</Label>
					<Select.Root type="single" value={selectedAssignedToId || 'none'} onValueChange={(v) => { selectedAssignedToId = v === 'none' ? '' : v; }}>
						<Select.Trigger id="assignedToId" class="w-full">
							{data.employees.find((e) => String(e.id) === selectedAssignedToId)?.name || 'Select employee'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="none">Select employee</Select.Item>
							{#each data.employees as employee}
								<Select.Item value={String(employee.id)}>{employee.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="assignedToId" value={selectedAssignedToId} />
				</div>

				<div class="space-y-2">
					<Label>Description / SLA</Label>
					<MarkdownEditor bind:value={description} placeholder="Service description, SLA terms..." />
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
						<Label for="clientId">Client *</Label>
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
						<Select.Root type="single" value={selectedContactId || 'none'} onValueChange={(v) => { selectedContactId = v === 'none' ? '' : v; }} disabled={!selectedClientId}>
							<Select.Trigger id="contactId" class="w-full">
								{#if !selectedClientId}
									Select client first
								{:else}
									{@const contact = filteredContacts.find((c) => String(c.id) === selectedContactId)}
									{contact ? `${contact.firstName} ${contact.lastName}` : 'Select contact'}
								{/if}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="none">None</Select.Item>
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
				<Card.Title>Financial & Schedule</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-3 gap-4">
					<div class="space-y-2">
						<Label for="monthlyFee">{feeLabel} Fee</Label>
						<Input
							id="monthlyFee"
							name="monthlyFee"
							type="number"
							step="0.01"
							min="0"
							placeholder="0.00"
							value={form?.values?.monthlyFee || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="taxRate">Tax Rate (%)</Label>
						<Input
							id="taxRate"
							name="taxRate"
							type="number"
							step="0.01"
							min="0"
							max="100"
							placeholder="0"
							value={form?.values?.taxRate || ''}
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
					<Label for="recurringPeriod">Billing Period</Label>
					<Select.Root type="single" value={selectedPeriod} onValueChange={(v) => { if (v) selectedPeriod = v; }}>
						<Select.Trigger id="recurringPeriod" class="w-full">
							{data.enums.recurring_period?.find((p) => p.value === selectedPeriod)?.label || selectedPeriod}
						</Select.Trigger>
						<Select.Content>
							{#each data.enums.recurring_period || [] as period}
								<Select.Item value={period.value}>{period.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="recurringPeriod" value={selectedPeriod} />
				</div>

				<div class="space-y-2">
					<Label for="budgetedHours">Budgeted Hours (per month)</Label>
					<DurationInput
						id="budgetedHours"
						name="budgetedHours"
						value={budgetedHours}
						onchange={(v) => (budgetedHours = v)}
						placeholder="e.g. 2d or 16h"
					/>
					<input type="hidden" name="budgetedHours" value={budgetedHours ?? ''} />
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="startDate">Start Date *</Label>
						<Input
							id="startDate"
							name="startDate"
							type="date"
							value={form?.values?.startDate || new Date().toISOString().split('T')[0]}
							required
						/>
					</div>

					<div class="space-y-2">
						<Label for="endDate">End Date</Label>
						<Input
							id="endDate"
							name="endDate"
							type="date"
							value={form?.values?.endDate || ''}
						/>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<div class="flex gap-4 max-w-2xl">
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Creating...' : 'Create Service'}
			</Button>
			<Button type="button" variant="outline" href="/services">Cancel</Button>
		</div>
	</form>
</div>
