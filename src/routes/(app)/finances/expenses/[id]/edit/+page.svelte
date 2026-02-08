<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import * as Alert from '$lib/components/ui/alert';
	import { ArrowLeft, AlertTriangle } from 'lucide-svelte';

	let { data, form } = $props();

	let isSubmitting = $state(false);

	// Get default values from enums
	const defaultCurrency = data.enums.currency.find((c) => c.isDefault)?.value || 'USD';
	const defaultStatus = data.enums.expense_status.find((s) => s.isDefault)?.value || 'pending';

	let selectedCurrency = $state(form?.values?.currency || data.expense.currency || defaultCurrency);
	let selectedCategory = $state(form?.values?.category || data.expense.category);
	let selectedStatus = $state(form?.values?.status || data.expense.status || defaultStatus);
	let selectedVendor = $state(form?.values?.vendorId || (data.expense.vendorId ? String(data.expense.vendorId) : ''));
	let selectedProject = $state(form?.values?.projectId || (data.expense.projectId ? String(data.expense.projectId) : ''));
	let selectedRecurringPeriod = $state(
		form?.values?.recurringPeriod || data.expense.recurringPeriod || ''
	);
	let isRecurring = $state(form?.values?.isRecurring ?? data.expense.isRecurring);
	let selectedPaymentTermDays = $state(
		form?.values?.paymentTermDays || (data.expense.paymentTermDays ? String(data.expense.paymentTermDays) : '')
	);

	const calculatedDueDate = $derived(() => {
		const dateVal = form?.values?.date || data.expense.date;
		if (dateVal && selectedPaymentTermDays) {
			const d = new Date(dateVal);
			d.setDate(d.getDate() + parseInt(selectedPaymentTermDays));
			return d.toISOString().split('T')[0];
		}
		return '';
	});
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/finances/expenses/{data.expense.id}">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Edit Expense</h1>
			<p class="text-muted-foreground">Update expense record</p>
		</div>
	</div>

	{#if data.expense.isDeleted}
		<Alert.Root variant="destructive" class="max-w-2xl">
			<AlertTriangle class="h-4 w-4" />
			<Alert.Title>Deleted Record</Alert.Title>
			<Alert.Description>
				This expense record has been deleted. You can edit it, but it won't appear in normal lists.
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
				<Card.Title>Expense Details</Card.Title>
				<Card.Description>Basic information about the expense</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="amount">Amount *</Label>
						<Input
							id="amount"
							name="amount"
							type="number"
							step="0.01"
							min="0"
							placeholder="0.00"
							value={form?.values?.amount || data.expense.amount}
							required
						/>
						{#if form?.errors?.amount}
							<p class="text-sm text-destructive">{form.errors.amount}</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="currency">Currency</Label>
						<Select.Root type="single" bind:value={selectedCurrency} name="currency">
							<Select.Trigger>
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
					<Label for="description">Description *</Label>
					<Input
						id="description"
						name="description"
						placeholder="Office supplies purchase"
						value={form?.values?.description || data.expense.description}
						required
					/>
					{#if form?.errors?.description}
						<p class="text-sm text-destructive">{form.errors.description}</p>
					{/if}
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="category">Category *</Label>
						<Select.Root type="single" bind:value={selectedCategory} name="category">
							<Select.Trigger>
								{data.enums.expense_category.find((c) => c.value === selectedCategory)?.label ||
									'Select category'}
							</Select.Trigger>
							<Select.Content>
								{#each data.enums.expense_category as category}
									<Select.Item value={category.value}>{category.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="category" value={selectedCategory} />
						{#if form?.errors?.category}
							<p class="text-sm text-destructive">{form.errors.category}</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="status">Status</Label>
						<Select.Root type="single" bind:value={selectedStatus} name="status">
							<Select.Trigger>
								{data.enums.expense_status.find((s) => s.value === selectedStatus)?.label || 'Select status'}
							</Select.Trigger>
							<Select.Content>
								{#each data.enums.expense_status as status}
									<Select.Item value={status.value}>{status.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="status" value={selectedStatus} />
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="date">Date *</Label>
						<Input
							id="date"
							name="date"
							type="date"
							value={form?.values?.date || data.expense.date}
							required
						/>
						{#if form?.errors?.date}
							<p class="text-sm text-destructive">{form.errors.date}</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="paymentTermDays">Payment Terms</Label>
						<Select.Root type="single" value={selectedPaymentTermDays} onValueChange={(v) => { selectedPaymentTermDays = v; }}>
							<Select.Trigger>
								{data.enums.payment_terms.find((pt) => pt.value === selectedPaymentTermDays)?.label || 'Select terms'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="">No terms</Select.Item>
								{#each data.enums.payment_terms as pt}
									<Select.Item value={pt.value}>{pt.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="paymentTermDays" value={selectedPaymentTermDays} />
						{#if calculatedDueDate()}
							<p class="text-xs text-muted-foreground">Due: {calculatedDueDate()}</p>
						{/if}
					</div>
				</div>

				</Card.Content>
		</Card.Root>

		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Recurring Settings</Card.Title>
				<Card.Description>Configure if this is a recurring expense</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex items-center space-x-2">
					<Checkbox
						id="isRecurring"
						checked={isRecurring}
						onCheckedChange={(checked) => (isRecurring = checked === true)}
					/>
					<Label for="isRecurring" class="cursor-pointer">This is a recurring expense</Label>
				</div>
				<input type="hidden" name="isRecurring" value={isRecurring.toString()} />

				{#if isRecurring}
					<div class="space-y-2">
						<Label for="recurringPeriod">Recurring Period *</Label>
						<Select.Root type="single" bind:value={selectedRecurringPeriod} name="recurringPeriod">
							<Select.Trigger>
								{data.enums.recurring_period.find((r) => r.value === selectedRecurringPeriod)?.label ||
									'Select period'}
							</Select.Trigger>
							<Select.Content>
								{#each data.enums.recurring_period as period}
									<Select.Item value={period.value}>{period.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="recurringPeriod" value={selectedRecurringPeriod} />
						{#if form?.errors?.recurringPeriod}
							<p class="text-sm text-destructive">{form.errors.recurringPeriod}</p>
						{/if}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Relations</Card.Title>
				<Card.Description>Link this expense to a vendor or project</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="vendorId">Vendor</Label>
						<Select.Root type="single" bind:value={selectedVendor} name="vendorId">
							<Select.Trigger>
								{data.vendors.find((v) => String(v.id) === selectedVendor)?.name || 'Select vendor'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="">No vendor</Select.Item>
								{#each data.vendors as vendor}
									<Select.Item value={String(vendor.id)}>{vendor.name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="vendorId" value={selectedVendor} />
					</div>

					<div class="space-y-2">
						<Label for="projectId">Project</Label>
						<Select.Root type="single" bind:value={selectedProject} name="projectId">
							<Select.Trigger>
								{data.projects.find((p) => String(p.id) === selectedProject)?.name || 'Select project'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="">No project</Select.Item>
								{#each data.projects as project}
									<Select.Item value={String(project.id)}>
										{project.name}
										{#if project.client}
											<span class="text-muted-foreground">({project.client.name})</span>
										{/if}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="projectId" value={selectedProject} />
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Additional Information</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="notes">Notes</Label>
					<Textarea
						id="notes"
						name="notes"
						placeholder="Additional notes..."
						rows={3}
						value={form?.values?.notes || data.expense.notes || ''}
					/>
				</div>
			</Card.Content>
		</Card.Root>

		<div class="flex gap-4 max-w-2xl">
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Saving...' : 'Save Changes'}
			</Button>
			<Button type="button" variant="outline" href="/finances/expenses/{data.expense.id}">
				Cancel
			</Button>
		</div>
	</form>
</div>
