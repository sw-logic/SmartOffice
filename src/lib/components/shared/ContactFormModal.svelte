<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Contact {
		id?: number;
		firstName: string;
		lastName: string;
		email: string | null;
		phone: string | null;
		mobile: string | null;
		position: string | null;
		isPrimaryContact: boolean;
	}

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		contact?: Contact | null;
		onSubmit: (contact: Omit<Contact, 'id'>) => Promise<{ success: boolean; error?: string }>;
		title?: string;
	}

	let {
		open = $bindable(),
		onOpenChange,
		contact = null,
		onSubmit,
		title = 'Add Contact'
	}: Props = $props();

	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	// Form fields
	let firstName = $state(contact?.firstName || '');
	let lastName = $state(contact?.lastName || '');
	let email = $state(contact?.email || '');
	let phone = $state(contact?.phone || '');
	let mobile = $state(contact?.mobile || '');
	let position = $state(contact?.position || '');
	let isPrimaryContact = $state(contact?.isPrimaryContact || false);

	// Reset form when modal opens/closes or contact changes
	$effect(() => {
		if (open) {
			firstName = contact?.firstName || '';
			lastName = contact?.lastName || '';
			email = contact?.email || '';
			phone = contact?.phone || '';
			mobile = contact?.mobile || '';
			position = contact?.position || '';
			isPrimaryContact = contact?.isPrimaryContact || false;
			error = null;
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();

		// Basic validation
		if (!firstName.trim()) {
			error = 'First name is required';
			return;
		}
		if (!lastName.trim()) {
			error = 'Last name is required';
			return;
		}
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			error = 'Please enter a valid email address';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const result = await onSubmit({
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				email: email.trim() || '',
				phone: phone.trim() || '',
				mobile: mobile.trim() || '',
				position: position.trim() || '',
				isPrimaryContact
			});

			if (result.success) {
				onOpenChange(false);
			} else {
				error = result.error || 'Failed to save contact';
			}
		} catch (err) {
			error = 'An unexpected error occurred';
		} finally {
			isSubmitting = false;
		}
	}

	function handleOpenChange(newOpen: boolean) {
		if (!isSubmitting) {
			onOpenChange(newOpen);
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>{contact?.id ? 'Edit Contact' : title}</Dialog.Title>
			<Dialog.Description>
				{contact?.id ? 'Update the contact information below.' : 'Add a new contact person.'}
			</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleSubmit} class="space-y-4">
			{#if error}
				<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="firstName">First Name *</Label>
					<Input
						id="firstName"
						placeholder="First name"
						bind:value={firstName}
						required
					/>
				</div>

				<div class="space-y-2">
					<Label for="lastName">Last Name *</Label>
					<Input
						id="lastName"
						placeholder="Last name"
						bind:value={lastName}
						required
					/>
				</div>
			</div>

			<div class="space-y-2">
				<Label for="position">Position / Title</Label>
				<Input
					id="position"
					placeholder="e.g., Project Manager, CEO"
					bind:value={position}
				/>
			</div>

			<div class="space-y-2">
				<Label for="email">Email</Label>
				<Input
					id="email"
					type="email"
					placeholder="contact@example.com"
					bind:value={email}
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="phone">Phone</Label>
					<Input
						id="phone"
						type="tel"
						placeholder="+1 (555) 123-4567"
						bind:value={phone}
					/>
				</div>

				<div class="space-y-2">
					<Label for="mobile">Mobile</Label>
					<Input
						id="mobile"
						type="tel"
						placeholder="+1 (555) 987-6543"
						bind:value={mobile}
					/>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<Checkbox
					id="isPrimaryContact"
					bind:checked={isPrimaryContact}
				/>
				<Label for="isPrimaryContact" class="cursor-pointer">
					Set as primary contact
				</Label>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={isSubmitting}>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Saving...' : (contact?.id ? 'Save Changes' : 'Add Contact')}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
