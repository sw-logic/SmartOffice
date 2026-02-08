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

	interface IncomeDefaults {
		clientId?: number;
		projectId?: number;
	}

	interface Props {
		open: boolean;
		incomeId?: number | null;
		isProjectedOccurrence?: boolean;
		defaults?: IncomeDefaults;
		clients: Array<{ id: number; name: string; paymentTerms: number }>;
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
		incomeId = null,
		isProjectedOccurrence = false,
		defaults,
		clients,
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
	let invoiceReference = $state('');

	const calculatedDueDate = $derived(() => {
		if (date && paymentTermDays) {
			const d = new Date(date);
			d.setDate(d.getDate() + parseInt(paymentTermDays));
			return d.toISOString().split('T')[0];
		}
		return '';
	});
	let tax = $state('');
	let isRecurring = $state(false);
	let recurringPeriod = $state('');
	let recurringEndDate = $state('');
	let selectedClient = $state('');
	let selectedProject = $state('');
	let notes = $state('');

	const isEditMode = $derived(incomeId != null);
	const title = $derived(
		isProjectedOccurrence ? 'Edit Projected Occurrence' : isEditMode ? 'Edit Income' : 'New Income'
	);

	const defaultCurrency = $derived(currencies.find((c) => c.isDefault)?.value || currencies[0]?.value || 'USD');
	const defaultStatus = $derived(statuses.find((s) => s.isDefault)?.value || statuses[0]?.value || 'pending');

	// Filter projects by selected client
	let filteredProjects = $derived(
		selectedClient
			? projects.filter((p) => (p.client?.id ? String(p.client.id) === selectedClient : false))
			: projects
	);

	function resetForm() {
		amount = '';
		currency = defaultCurrency;
		description = '';
		category = '';
		status = defaultStatus;
		date = new Date().toISOString().split('T')[0];
		paymentTermDays = '';
		invoiceReference = '';
		tax = '0';
		isRecurring = false;
		recurringPeriod = '';
		recurringEndDate = '';
		selectedClient = defaults?.clientId ? String(defaults.clientId) : '';
		selectedProject = defaults?.projectId ? String(defaults.projectId) : '';
		notes = '';
		parentId = null;
		error = null;
	}

	async function loadIncome(id: number) {
		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/income/${id}`);
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to load income');
			}
			const { income } = await res.json();
			amount = String(income.amount);
			currency = income.currency || defaultCurrency;
			description = income.description || '';
			category = income.category || '';
			status = income.status || defaultStatus;
			date = income.date ? new Date(income.date).toISOString().split('T')[0] : '';
			paymentTermDays = income.paymentTermDays ? String(income.paymentTermDays) : '';
			invoiceReference = income.invoiceReference || '';
			tax = income.tax != null ? String(income.tax) : '0';
			isRecurring = income.isRecurring || false;
			recurringPeriod = income.recurringPeriod || '';
			recurringEndDate = income.recurringEndDate ? new Date(income.recurringEndDate).toISOString().split('T')[0] : '';
			selectedClient = income.clientId ? String(income.clientId) : '';
			selectedProject = income.projectId ? String(income.projectId) : '';
			notes = income.notes || '';
			parentId = income.parentId || null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load income';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (open) {
			if (incomeId != null) {
				loadIncome(incomeId);
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
			invoiceReference: invoiceReference || null,
			tax,
			isRecurring,
			recurringPeriod: isRecurring ? recurringPeriod : null,
			recurringEndDate: isRecurring && recurringEndDate ? recurringEndDate : null,
			clientId: selectedClient || null,
			projectId: selectedProject || null,
			notes: notes || null
		};

		try {
			const url = isEditMode ? `/api/income/${incomeId}` : '/api/income';
			const method = isEditMode ? 'PATCH' : 'POST';

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to save income');
			}

			toast.success(isEditMode ? 'Income updated successfully' : 'Income created successfully');
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
					: isEditMode ? 'Update this income record.' : 'Record a new income entry.'}
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
									incomeId = parentId;
									isProjectedOccurrence = false;
									loadIncome(parentId!);
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
						<Label for="incAmount">Amount *</Label>
						<Input
							id="incAmount"
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
                        <Label for="incTax">Tax (%) *</Label>
                        <Input
                                id="incTax"
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
						<Label for="incCurrency">Currency</Label>
						<Select.Root type="single" value={currency} onValueChange={(v) => { if (v) currency = v; }}>
							<Select.Trigger id="incCurrency" class="w-full">
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
                        <Label for="incDescription">Description *</Label>
                        <Input
                                id="incDescription"
                                placeholder="Payment for services"
                                bind:value={description}
                                required
                        />
                    </div>

                    <div class="space-y-2">
                        <Label for="incInvoiceRef">Invoice Reference</Label>
                        <Input
                                id="incInvoiceRef"
                                placeholder="INV-2024-001"
                                bind:value={invoiceReference}
                        />
                    </div>
                </div>

                <div class="space-y-2">
                    <Label for="incNotes">Notes</Label>
                    <Textarea
                            id="incNotes"
                            placeholder="Additional notes..."
                            bind:value={notes}
                            rows={3}
                    />
                </div>

                <hr>

				<div class="grid grid-cols-3 gap-4">
                    <div class="space-y-2">
                        <Label for="incClient">Client</Label>
                        <Select.Root type="single" value={selectedClient} onValueChange={(v) => { selectedClient = v; if (!v) selectedProject = ''; else if (!paymentTermDays) { const cl = clients.find(c => String(c.id) === v); if (cl) paymentTermDays = String(cl.paymentTerms); } }}>
                            <Select.Trigger id="incClient" class="w-full">
                                {clients.find((c) => String(c.id) === selectedClient)?.name || 'Select client'}
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="">No client</Select.Item>
                                {#each clients as client}
                                    <Select.Item value={String(client.id)}>{client.name}</Select.Item>
                                {/each}
                            </Select.Content>
                        </Select.Root>
                    </div>

                    <div class="space-y-2">
                        <Label for="incProject">Project</Label>
                        <Select.Root type="single" value={selectedProject} onValueChange={(v) => { selectedProject = v; }}>
                            <Select.Trigger id="incProject" class="w-full">
                                {filteredProjects.find((p) => String(p.id) === selectedProject)?.name || 'Select project'}
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="">No project</Select.Item>
                                {#each filteredProjects as project}
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
						<Label for="incCategory">Category *</Label>
						<Select.Root type="single" value={category} onValueChange={(v) => { if (v) category = v; }}>
							<Select.Trigger id="incCategory" class="w-full">
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

				<div class="grid grid-cols-3 gap-4">
					<div class="space-y-2">
						<Label for="incDate">Date *</Label>
						<Input id="incDate" class="w-full" type="date" bind:value={date} required />
					</div>

					<div class="space-y-2">
						<Label for="incPaymentTerms">Payment Terms</Label>
						<Select.Root type="single" value={paymentTermDays} onValueChange={(v) => { paymentTermDays = v; }}>
							<Select.Trigger id="incPaymentTerms" class="w-full">
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

                    <div class="space-y-2">
                        <Label for="incStatus">Status</Label>
                        <Select.Root type="single" value={status} onValueChange={(v) => { if (v) status = v; }}>
                            <Select.Trigger id="incStatus" class="w-full">
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

                {#if !isProjectedOccurrence}
                <hr>

				<div class="space-y-3">
                    <div class="grid grid-cols-2 gap-8">
                        <div class="grid grid-cols-2 gap-4 items-end">
                            <div class="flex items-center space-x-2 pb-3">
                                <Checkbox
                                        id="incIsRecurring"
                                        checked={isRecurring}
                                        onCheckedChange={(checked) => {
                                            isRecurring = checked === true;
                                            if (!isRecurring) {
                                                recurringPeriod = '';
                                                recurringEndDate = '';
                                            }
                                        }}
                                />
                                <Label for="incIsRecurring" class="cursor-pointer">Recurring income</Label>
                            </div>

                            <div class="space-y-2">
                                <Select.Root type="single" value={recurringPeriod} onValueChange={(v) => { if (v) recurringPeriod = v; }}>
                                    <Select.Trigger id="incRecurringPeriod" disabled={!isRecurring} class={!isRecurring ? 'pointer-events-none' : ''}>
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
                                <Label for="incRecurringEndDate">Generate until</Label>
                                <Input id="incRecurringEndDate" class="w-full" type="date" bind:value={recurringEndDate} />
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
						{saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Income'}
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
