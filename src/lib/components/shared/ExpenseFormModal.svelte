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
		isProjectedOccurrence?: boolean;
		defaults?: ExpenseDefaults;
		vendors: Array<{ id: number; name: string; paymentTerms: number }>;
		projects: Array<{ id: number; name: string; client?: { id: number; name: string } | null }>;
		categories: EnumOption[];
		currencies: EnumOption[];
		statuses: EnumOption[];
		recurringPeriods: EnumOption[];
		paymentTerms: EnumOption[];
		onSaved?: () => void;
	}

	let {
		open = $bindable(),
		expenseId = null,
		isProjectedOccurrence = false,
		defaults,
		vendors,
		projects,
		categories,
		currencies,
		statuses,
		recurringPeriods,
		paymentTerms,
		onSaved
	}: Props = $props();

	let loading = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let parentId = $state<number | null>(null);

	// Form fields
	let amount = $state('');
	let currency = $state('');
	let description = $state('');
	let category = $state('');
	let status = $state('');
	let date = $state('');
	let paymentTermDays = $state('');
	let tax = $state('');

	const calculatedDueDate = $derived(() => {
		if (date && paymentTermDays) {
			const d = new Date(date);
			d.setDate(d.getDate() + parseInt(paymentTermDays));
			return d.toISOString().split('T')[0];
		}
		return '';
	});
	let isRecurring = $state(false);
	let recurringPeriod = $state('');
	let recurringEndDate = $state('');
	let selectedVendor = $state('');
	let selectedProject = $state('');
	let notes = $state('');

	const isEditMode = $derived(expenseId != null);
	const title = $derived(
		isProjectedOccurrence ? 'Edit Projected Occurrence' : isEditMode ? 'Edit Expense' : 'New Expense'
	);

	const defaultCurrency = $derived(currencies.find((c) => c.isDefault)?.value || currencies[0]?.value || 'USD');
	const defaultStatus = $derived(statuses.find((s) => s.isDefault)?.value || statuses[0]?.value || 'pending');

	function resetForm() {
		amount = '';
		currency = defaultCurrency;
		description = '';
		category = '';
		status = defaultStatus;
		date = new Date().toISOString().split('T')[0];
		paymentTermDays = '';
		tax = '0';
		isRecurring = false;
		recurringPeriod = '';
		recurringEndDate = '';
		selectedVendor = defaults?.vendorId ? String(defaults.vendorId) : '';
		selectedProject = defaults?.projectId ? String(defaults.projectId) : '';
		notes = '';
		parentId = null;
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
			paymentTermDays = expense.paymentTermDays ? String(expense.paymentTermDays) : '';
			tax = expense.tax != null ? String(expense.tax) : '0';
			isRecurring = expense.isRecurring || false;
			recurringPeriod = expense.recurringPeriod || '';
			recurringEndDate = expense.recurringEndDate ? new Date(expense.recurringEndDate).toISOString().split('T')[0] : '';
			selectedVendor = expense.vendorId ? String(expense.vendorId) : '';
			selectedProject = expense.projectId ? String(expense.projectId) : '';
			notes = expense.notes || '';
			parentId = expense.parentId || null;
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
			paymentTermDays: paymentTermDays || null,
			tax,
			isRecurring,
			recurringPeriod: isRecurring ? recurringPeriod : null,
			recurringEndDate: isRecurring && recurringEndDate ? recurringEndDate : null,
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
				{isProjectedOccurrence
					? 'Edit this projected occurrence. Changes apply only to this occurrence.'
					: isEditMode ? 'Update this expense record.' : 'Record a new expense entry.'}
			</Dialog.Description>
		</Dialog.Header>

		{#if loading}
			<div class="flex items-center justify-center py-8">
				<div class="text-muted-foreground">Loading...</div>
			</div>
		{:else}
			<form onsubmit={handleSubmit} class="space-y-4">
				{#if isProjectedOccurrence && parentId}
					<div class="rounded-md border border-dashed border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 text-sm">
						<div class="flex items-center justify-between">
							<span class="text-blue-700 dark:text-blue-300 font-medium">Projected occurrence</span>
							<Button
								type="button"
								variant="link"
								size="sm"
								class="text-blue-600 dark:text-blue-400 h-auto p-0"
								onclick={() => {
									expenseId = parentId;
									isProjectedOccurrence = false;
									loadExpense(parentId!);
								}}
							>
								View original record
							</Button>
						</div>
					</div>
				{/if}

				{#if error}
					<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
						{error}
					</div>
				{/if}

				<div class="grid grid-cols-3 gap-4">
					<div class="space-y-2">
						<Label for="expAmount">Amount *</Label>
						<Input
							id="expAmount"
							class="w-full"
							type="number"
							step="0.01"
							min="0"
							placeholder="0.00"
							bind:value={amount}
							required
						/>
					</div>
					<div class="space-y-2">
						<Label for="expTax">Tax (%) *</Label>
						<Input
							id="expTax"
							class="w-full"
							type="number"
							step="0.01"
							min="0"
							max="100"
							placeholder="0"
							bind:value={tax}
							required
						/>
					</div>
					<div class="space-y-2">
						<Label for="expCurrency">Currency</Label>
						<Select.Root type="single" value={currency} onValueChange={(v) => { if (v) currency = v; }}>
							<Select.Trigger id="expCurrency" class="w-full">
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

				<div class="grid grid-cols-3 gap-4">
					<div class="col-span-2 space-y-2">
						<Label for="expDescription">Description *</Label>
						<Input
							id="expDescription"
							placeholder="Office supplies purchase"
							bind:value={description}
							required
						/>
					</div>

					<div class="space-y-2">
						<Label for="expCategory">Category *</Label>
						<Select.Root type="single" value={category} onValueChange={(v) => { if (v) category = v; }}>
							<Select.Trigger id="expCategory" class="w-full">
								{categories.find((c) => c.value === category)?.label || 'Select category'}
							</Select.Trigger>
							<Select.Content>
								{#each categories as cat}
									<Select.Item value={cat.value}>{cat.label}</Select.Item>
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

				<hr>

				<div class="grid grid-cols-3 gap-4">
					<div class="space-y-2">
						<Label for="expVendor">Vendor</Label>
						<Select.Root type="single" value={selectedVendor} onValueChange={(v) => { selectedVendor = v; if (v && !paymentTermDays) { const vn = vendors.find(x => String(x.id) === v); if (vn) paymentTermDays = String(vn.paymentTerms); } }}>
							<Select.Trigger id="expVendor" class="w-full">
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
							<Select.Trigger id="expProject" class="w-full">
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

					<div class="space-y-2">
						<Label for="expStatus">Status</Label>
						<Select.Root type="single" value={status} onValueChange={(v) => { if (v) status = v; }}>
							<Select.Trigger id="expStatus" class="w-full">
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

				<div class="grid grid-cols-3 gap-4">
					<div class="space-y-2">
						<Label for="expDate">Date *</Label>
						<Input id="expDate" class="w-full" type="date" bind:value={date} required />
					</div>

					<div class="space-y-2">
						<Label for="expPaymentTerms">Payment Terms</Label>
						<Select.Root type="single" value={paymentTermDays} onValueChange={(v) => { paymentTermDays = v; }}>
							<Select.Trigger id="expPaymentTerms" class="w-full">
								{paymentTerms.find((pt) => pt.value === paymentTermDays)?.label || 'Select terms'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="">No terms</Select.Item>
								{#each paymentTerms as pt}
									<Select.Item value={pt.value}>{pt.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						{#if calculatedDueDate()}
							<p class="text-xs text-muted-foreground">Due: {calculatedDueDate()}</p>
						{/if}
					</div>
				</div>

				{#if !isProjectedOccurrence}
				<hr>

				<div class="space-y-3">
					<div class="grid grid-cols-2 gap-8">
						<div class="grid grid-cols-2 gap-4 items-end">
							<div class="flex items-center space-x-2 pb-3">
								<Checkbox
									id="expIsRecurring"
									checked={isRecurring}
									onCheckedChange={(checked) => {
										isRecurring = checked === true;
										if (!isRecurring) {
											recurringPeriod = '';
											recurringEndDate = '';
										}
									}}
								/>
								<Label for="expIsRecurring" class="cursor-pointer">Recurring expense</Label>
							</div>

							<div class="space-y-2">
								<Select.Root type="single" value={recurringPeriod} onValueChange={(v) => { if (v) recurringPeriod = v; }}>
									<Select.Trigger id="expRecurringPeriod" disabled={!isRecurring} class={!isRecurring ? 'pointer-events-none' : ''}>
										{recurringPeriods.find((r) => r.value === recurringPeriod)?.label || 'Select period'}
									</Select.Trigger>
									<Select.Content>
										{#each recurringPeriods as period}
											<Select.Item value={period.value}>{period.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
						</div>
					</div>

					{#if isRecurring}
						<div class="grid grid-cols-2 gap-8">
							<div class="space-y-2">
								<Label for="expRecurringEndDate">Generate until</Label>
								<Input id="expRecurringEndDate" class="w-full" type="date" bind:value={recurringEndDate} />
							</div>
							<div class="flex items-end gap-2 pb-0.5">
								<Button type="button" variant="outline" size="sm" onclick={() => {
									const y = new Date().getFullYear();
									recurringEndDate = `${y}-12-31`;
								}}>End of Year</Button>
								<Button type="button" variant="outline" size="sm" onclick={() => {
									const y = new Date().getFullYear() + 1;
									recurringEndDate = `${y}-12-31`;
								}}>End of Next Year</Button>
							</div>
						</div>
					{/if}
				</div>
			{/if}

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
