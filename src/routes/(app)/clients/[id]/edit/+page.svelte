<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import * as Alert from '$lib/components/ui/alert';
	import { ArrowLeft, AlertTriangle } from 'lucide-svelte';

	let { data, form } = $props();

	let isSubmitting = $state(false);

	// Get default values from enums
	const defaultStatus = data.enums.entity_status.find((s) => s.isDefault)?.value || 'active';
	const defaultCurrency = data.enums.currency.find((c) => c.isDefault)?.value || 'USD';

	let selectedStatus = $state(form?.values?.status || data.client.status || defaultStatus);
	let selectedIndustry = $state(form?.values?.industry || data.client.industry || '');
	let selectedCurrency = $state(form?.values?.currency || data.client.currency || defaultCurrency);
	let selectedPaymentTerms = $state(String(form?.values?.paymentTerms || data.client.paymentTerms || 30));
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/clients/{data.client.id}">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Edit Client</h1>
			<p class="text-muted-foreground">Update client information</p>
		</div>
	</div>

	{#if data.client.isDeleted}
		<Alert.Root variant="destructive" class="max-w-2xl">
			<AlertTriangle class="h-4 w-4" />
			<Alert.Title>Deleted Client</Alert.Title>
			<Alert.Description>
				This client has been deleted. You can edit its details, but it won't appear in normal lists until restored.
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
				<Card.Description>Update the client's basic details</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="name">Client Name *</Label>
						<Input
							id="name"
							name="name"
							placeholder="Enter client name"
							value={form?.values?.name || data.client.name}
							required
						/>
						{#if form?.errors?.name}
							<p class="text-sm text-destructive">{form.errors.name}</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="companyName">Company Name</Label>
						<Input
							id="companyName"
							name="companyName"
							placeholder="Enter company name"
							value={form?.values?.companyName || data.client.companyName || ''}
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input
							id="email"
							name="email"
							type="email"
							placeholder="client@example.com"
							value={form?.values?.email || data.client.email || ''}
						/>
						{#if form?.errors?.email}
							<p class="text-sm text-destructive">{form.errors.email}</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="phone">Phone</Label>
						<Input
							id="phone"
							name="phone"
							type="tel"
							placeholder="+1 (555) 123-4567"
							value={form?.values?.phone || data.client.phone || ''}
						/>
					</div>
				</div>

				<div class="space-y-2">
					<Label for="website">Website</Label>
					<Input
						id="website"
						name="website"
						type="url"
						placeholder="https://example.com"
						value={form?.values?.website || data.client.website || ''}
					/>
					{#if form?.errors?.website}
						<p class="text-sm text-destructive">{form.errors.website}</p>
					{/if}
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="industry">Industry</Label>
						<Select.Root type="single" bind:value={selectedIndustry} name="industry">
							<Select.Trigger>
								{data.enums.client_industry.find((i) => i.value === selectedIndustry)?.label || 'Select industry'}
							</Select.Trigger>
							<Select.Content>
								{#each data.enums.client_industry as industry}
									<Select.Item value={industry.value}>{industry.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="industry" value={selectedIndustry} />
					</div>

					<div class="space-y-2">
						<Label for="status">Status</Label>
						<Select.Root type="single" bind:value={selectedStatus} name="status">
							<Select.Trigger>
								{data.enums.entity_status.find((s) => s.value === selectedStatus)?.label || 'Select status'}
							</Select.Trigger>
							<Select.Content>
								{#each data.enums.entity_status as status}
									<Select.Item value={status.value}>{status.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="status" value={selectedStatus} />
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Address</Card.Title>
				<Card.Description>Client's physical address</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="street">Street Address</Label>
					<Input
						id="street"
						name="street"
						placeholder="123 Main Street"
						value={form?.values?.street || data.client.street || ''}
					/>
				</div>

				<div class="grid grid-cols-3 gap-4">
					<div class="space-y-2">
						<Label for="city">City</Label>
						<Input
							id="city"
							name="city"
							placeholder="City"
							value={form?.values?.city || data.client.city || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="postalCode">Postal Code</Label>
						<Input
							id="postalCode"
							name="postalCode"
							placeholder="12345"
							value={form?.values?.postalCode || data.client.postalCode || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="country">Country</Label>
						<Input
							id="country"
							name="country"
							placeholder="Country"
							value={form?.values?.country || data.client.country || ''}
						/>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Business Information</Card.Title>
				<Card.Description>Tax and payment details</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="taxId">Tax ID</Label>
						<Input
							id="taxId"
							name="taxId"
							placeholder="Tax identification number"
							value={form?.values?.taxId || data.client.taxId || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="vatNumber">VAT Number</Label>
						<Input
							id="vatNumber"
							name="vatNumber"
							placeholder="VAT registration number"
							value={form?.values?.vatNumber || data.client.vatNumber || ''}
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="paymentTerms">Payment Terms</Label>
						<Select.Root type="single" value={selectedPaymentTerms} onValueChange={(v) => { if (v) selectedPaymentTerms = v; }}>
							<Select.Trigger id="paymentTerms" class="w-full">
								{data.enums.payment_terms.find((pt) => pt.value === selectedPaymentTerms)?.label || 'Select terms'}
							</Select.Trigger>
							<Select.Content>
								{#each data.enums.payment_terms as pt}
									<Select.Item value={pt.value}>{pt.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="paymentTerms" value={selectedPaymentTerms} />
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
					<Label for="notes">Notes</Label>
					<Textarea
						id="notes"
						name="notes"
						placeholder="Additional notes about this client..."
						rows={4}
						value={form?.values?.notes || data.client.notes || ''}
					/>
				</div>
			</Card.Content>
		</Card.Root>

		<div class="flex gap-4 max-w-2xl">
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Saving...' : 'Save Changes'}
			</Button>
			<Button type="button" variant="outline" href="/clients/{data.client.id}">Cancel</Button>
		</div>
	</form>
</div>
