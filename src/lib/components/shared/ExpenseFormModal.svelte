<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { toast } from 'svelte-sonner';

	interface EnumOption {
		value: string;
		label: string;
		isDefault?: boolean;
	}

	interface ExpenseDefaults {
		vendorId?: number;
		projectId?: number;
	}

	interface Props {
		open: boolean;
		expenseId?: number | null;
		defaults?: ExpenseDefaults;
		vendors: Array<{ id: number; name: string }>;
		projects: Array<{ id: number; name: string; client?: { id: number; name: string } | null }>;
		categories: EnumOption[];
		currencies: EnumOption[];
		statuses: EnumOption[];
		recurringPeriods: EnumOption[];
		onSaved?: () => void;
	}

	let {
		open = $bindable(),
		expenseId = null,
		defaults,
		vendors,
		projects,
		categories,
		currencies,
		statuses,
		recurringPeriods,
		onSaved
	}: Props = $props();

	let loading = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);

	// Form fields
	let amount = $state('');
	let currency = $state('');
	let description = $state('');
	let category = $state('');
	let status = $state('');
	let date = $state('');
	let dueDate = $state('');
	let tax = $state('');
	let taxDeductible = $state(true);
	let isRecurring = $state(false);
	let recurringPeriod = $state('');
	let selectedVendor = $state('');
	let selectedProject = $state('');
	let notes = $state('');

	const isEditMode = $derived(expenseId != null);
	const title = $derived(isEditMode ? 'Edit Expense' : 'New Expense');

	const defaultCurrency = $derived(currencies.find((c) => c.isDefault)?.value || currencies[0]?.value || 'USD');
	const defaultStatus = $derived(statuses.find((s) => s.isDefault)?.value || statuses[0]?.value || 'pending');

	function resetForm() {
		amount = '';
		currency = defaultCurrency;
		description = '';
		category = '';
		status = defaultStatus;
		date = new Date().toISOString().split('T')[0];
		dueDate = '';
		tax = '0';
		taxDeductible = true;
		isRecurring = false;
		recurringPeriod = '';
		selectedVendor = defaults?.vendorId ? String(defaults.vendorId) : '';
		selectedProject = defaults?.projectId ? String(defaults.projectId) : '';
		notes = '';
		error = null;
	}

	async function loadExpense(id: number) {
		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/expenses/${id}`);
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to load expense');
			}
			const { expense } = await res.json();
			amount = String(expense.amount);
			currency = expense.currency || defaultCurrency;
			description = expense.description || '';
			category = expense.category || '';
			status = expense.status || defaultStatus;
			date = expense.date ? new Date(expense.date).toISOString().split('T')[0] : '';
			dueDate = expense.dueDate ? new Date(expense.dueDate).toISOString().split('T')[0] : '';
			tax = expense.tax != null ? String(expense.tax) : '0';
			taxDeductible = expense.taxDeductible ?? true;
			isRecurring = expense.isRecurring || false;
			recurringPeriod = expense.recurringPeriod || '';
			selectedVendor = expense.vendorId ? String(expense.vendorId) : '';
			selectedProject = expense.projectId ? String(expense.projectId) : '';
			notes = expense.notes || '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load expense';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open) {
			if (expenseId != null) {
				loadExpense(expenseId);
			} else {
				resetForm();
			}
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		saving = true;
		error = null;

		const payload = {
			amount,
			currency,
			description,
			category,
			status,
			date,
			dueDate: dueDate || null,
			tax,
			taxDeductible,
			isRecurring,
			recurringPeriod: isRecurring ? recurringPeriod : null,
			vendorId: selectedVendor || null,
			projectId: selectedProject || null,
			notes: notes || null
		};

		try {
			const url = isEditMode ? `/api/expenses/${expenseId}` : '/api/expenses';
			const method = isEditMode ? 'PATCH' : 'POST';

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to save expense');
			}

			toast.success(isEditMode ? 'Expense updated successfully' : 'Expense created successfully');
			open = false;
			onSaved?.();
		} catch (e) {
			error = e instanceof Error ? e.message : 'An unexpected error occurred';
		} finally {
			saving = false;
		}
	}

	function handleOpenChange(newOpen: boolean) {
		if (!saving) {
			open = newOpen;
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>
				{isEditMode ? 'Update this expense record.' : 'Record a new expense entry.'}
			</Dialog.Description>
		</Dialog.Header>

		{#if loading}
			<div class="flex items-center justify-center py-8">
				<div class="text-muted-foreground">Loading...</div>
			</div>
		{:else}
			<form onsubmit={handleSubmit} class="space-y-4">
				{#if error}
					<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
						{error}
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="expAmount">Amount *</Label>
						<Input
							id="expAmount"
							type="number"
							step="0.01"
							min="0"
							placeholder="0.00"
							bind:value={amount}
							required
						/>
					</div>

					<div class="space-y-2">
						<Label for="expCurrency">Currency</Label>
						<Select.Root type="single" value={currency} onValueChange={(v) => { if (v) currency = v; }}>
							<Select.Trigger id="expCurrency">
								{currencies.find((c) => c.value === currency)?.label || currency}
							</Select.Trigger>
							<Select.Content>
								{#each currencies as cur}
									<Select.Item value={cur.value}>{cur.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<div class="space-y-2">
					<Label for="expDescription">Description *</Label>
					<Input
						id="expDescription"
						placeholder="Office supplies purchase"
						bind:value={description}
						required
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="expCategory">Category *</Label>
						<Select.Root type="single" value={category} onValueChange={(v) => { if (v) category = v; }}>
							<Select.Trigger id="expCategory">
								{categories.find((c) => c.value === category)?.label || 'Select category'}
							</Select.Trigger>
							<Select.Content>
								{#each categories as cat}
									<Select.Item value={cat.value}>{cat.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					<div class="space-y-2">
						<Label for="expStatus">Status</Label>
						<Select.Root type="single" value={status} onValueChange={(v) => { if (v) status = v; }}>
							<Select.Trigger id="expStatus">
								{statuses.find((s) => s.value === status)?.label || 'Select status'}
							</Select.Trigger>
							<Select.Content>
								{#each statuses as st}
									<Select.Item value={st.value}>{st.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="expDate">Date *</Label>
						<Input id="expDate" type="date" bind:value={date} required />
					</div>

					<div class="space-y-2">
						<Label for="expDueDate">Due Date</Label>
						<Input id="expDueDate" type="date" bind:value={dueDate} />
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="expTax">Tax (%) *</Label>
						<Input
							id="expTax"
							type="number"
							step="0.01"
							min="0"
							max="100"
							placeholder="0"
							bind:value={tax}
							required
						/>
					</div>
				</div>

				<div class="flex items-center space-x-2">
					<Checkbox
						id="expTaxDeductible"
						checked={taxDeductible}
						onCheckedChange={(checked) => (taxDeductible = checked === true)}
					/>
					<Label for="expTaxDeductible" class="cursor-pointer">Tax deductible expense</Label>
				</div>

				<div class="grid grid-cols-2 gap-4 items-end">
					<div class="flex items-center space-x-2 pb-1">
						<Checkbox
							id="expIsRecurring"
							checked={isRecurring}
							onCheckedChange={(checked) => (isRecurring = checked === true)}
						/>
						<Label for="expIsRecurring" class="cursor-pointer">Recurring expense</Label>
					</div>

					{#if isRecurring}
						<div class="space-y-2">
							<Label for="expRecurringPeriod">Period *</Label>
							<Select.Root type="single" value={recurringPeriod} onValueChange={(v) => { if (v) recurringPeriod = v; }}>
								<Select.Trigger id="expRecurringPeriod">
									{recurringPeriods.find((r) => r.value === recurringPeriod)?.label || 'Select period'}
								</Select.Trigger>
								<Select.Content>
									{#each recurringPeriods as period}
										<Select.Item value={period.value}>{period.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					{/if}
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="expVendor">Vendor</Label>
						<Select.Root type="single" value={selectedVendor} onValueChange={(v) => { selectedVendor = v; }}>
							<Select.Trigger id="expVendor">
								{vendors.find((v) => String(v.id) === selectedVendor)?.name || 'Select vendor'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="">No vendor</Select.Item>
								{#each vendors as vendor}
									<Select.Item value={String(vendor.id)}>{vendor.name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>

					<div class="space-y-2">
						<Label for="expProject">Project</Label>
						<Select.Root type="single" value={selectedProject} onValueChange={(v) => { selectedProject = v; }}>
							<Select.Trigger id="expProject">
								{projects.find((p) => String(p.id) === selectedProject)?.name || 'Select project'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="">No project</Select.Item>
								{#each projects as project}
									<Select.Item value={String(project.id)}>
										{project.name}
										{#if project.client}
											<span class="text-muted-foreground">({project.client.name})</span>
										{/if}
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				<div class="space-y-2">
					<Label for="expNotes">Notes</Label>
					<Textarea
						id="expNotes"
						placeholder="Additional notes..."
						bind:value={notes}
						rows={3}
					/>
				</div>

				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={saving}>
						Cancel
					</Button>
					<Button type="submit" disabled={saving}>
						{saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Expense'}
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
