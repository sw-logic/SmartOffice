<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { ArrowLeft } from 'lucide-svelte';

	let { data, form } = $props();

	let isSubmitting = $state(false);

	// Get default values from enums
	const defaultCurrency = data.enums.currency.find((c) => c.isDefault)?.value || 'USD';
	const defaultUnit = data.enums.unit_of_measure.find((u) => u.isDefault)?.value || 'hour';

	let selectedCurrency = $state(form?.values?.currency || defaultCurrency);
	let selectedCategory = $state(form?.values?.category || '');
	let selectedUnit = $state(form?.values?.unitOfMeasure || defaultUnit);
	let isActive = $state(form?.values?.active ?? true);
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/pricelists">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<div>
			<h1 class="text-3xl font-bold tracking-tight">New Price List Item</h1>
			<p class="text-muted-foreground">Add a new product or service to your price list</p>
		</div>
	</div>

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
				<Card.Title>Item Details</Card.Title>
				<Card.Description>Basic information about the item</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-3 gap-4">
					<div class="col-span-2 space-y-2">
						<Label for="name">Name *</Label>
						<Input
							id="name"
							name="name"
							placeholder="Web Development"
							value={form?.values?.name || ''}
							required
						/>
						{#if form?.errors?.name}
							<p class="text-sm text-destructive">{form.errors.name}</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="sku">SKU</Label>
						<Input
							id="sku"
							name="sku"
							placeholder="WEB-DEV-001"
							value={form?.values?.sku || ''}
						/>
						{#if form?.errors?.sku}
							<p class="text-sm text-destructive">{form.errors.sku}</p>
						{/if}
					</div>
				</div>

				<div class="space-y-2">
					<Label for="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						placeholder="Full-stack web development services..."
						rows={2}
						value={form?.values?.description || ''}
					/>
				</div>

				<div class="space-y-2">
					<Label for="category">Category</Label>
					<Select.Root type="single" bind:value={selectedCategory} name="category">
						<Select.Trigger>
							{data.categories.find((c) => c.value === selectedCategory)?.label || 'Select category'}
						</Select.Trigger>
						<Select.Content>
							{#each data.categories as cat}
								<Select.Item value={cat.value}>{cat.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="category" value={selectedCategory} />
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Pricing</Card.Title>
				<Card.Description>Set the price and unit of measure</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-3 gap-4">
					<div class="space-y-2">
						<Label for="unitPrice">Unit Price *</Label>
						<Input
							id="unitPrice"
							name="unitPrice"
							type="number"
							step="0.01"
							min="0"
							placeholder="0.00"
							value={form?.values?.unitPrice || ''}
							required
						/>
						{#if form?.errors?.unitPrice}
							<p class="text-sm text-destructive">{form.errors.unitPrice}</p>
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

					<div class="space-y-2">
						<Label for="unitOfMeasure">Unit of Measure</Label>
						<Select.Root type="single" bind:value={selectedUnit} name="unitOfMeasure">
							<Select.Trigger>
								{data.enums.unit_of_measure.find((u) => u.value === selectedUnit)?.label || 'Select unit'}
							</Select.Trigger>
							<Select.Content>
								{#each data.enums.unit_of_measure as unit}
									<Select.Item value={unit.value}>{unit.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="unitOfMeasure" value={selectedUnit} />
					</div>
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
						class="w-32"
						value={form?.values?.taxRate || ''}
					/>
					{#if form?.errors?.taxRate}
						<p class="text-sm text-destructive">{form.errors.taxRate}</p>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Validity & Status</Card.Title>
				<Card.Description>Set when this item is available</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex items-center space-x-2">
					<Checkbox
						id="active"
						checked={isActive}
						onCheckedChange={(checked) => (isActive = checked === true)}
					/>
					<Label for="active" class="cursor-pointer">Item is active and available for use</Label>
				</div>
				<input type="hidden" name="active" value={isActive.toString()} />

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="validFrom">Valid From</Label>
						<Input
							id="validFrom"
							name="validFrom"
							type="date"
							value={form?.values?.validFrom || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="validTo">Valid To</Label>
						<Input
							id="validTo"
							name="validTo"
							type="date"
							value={form?.values?.validTo || ''}
						/>
						{#if form?.errors?.validTo}
							<p class="text-sm text-destructive">{form.errors.validTo}</p>
						{/if}
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
						placeholder="Internal notes about this item..."
						rows={3}
						value={form?.values?.notes || ''}
					/>
				</div>
			</Card.Content>
		</Card.Root>

		<div class="flex gap-4 max-w-2xl">
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Creating...' : 'Create Item'}
			</Button>
			<Button type="button" variant="outline" href="/pricelists">Cancel</Button>
		</div>
	</form>
</div>
