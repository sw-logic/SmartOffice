<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Card from '$lib/components/ui/card';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Camera } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let { data, form } = $props();

	let isSubmitting = $state(false);
	let isChangingPassword = $state(false);

	// Type helpers
	type FormErrors = Record<string, string> | undefined;
	const errors = $derived(form?.errors as FormErrors);
	const passwordErrors = $derived(form?.passwordErrors as FormErrors);

	// Avatar state
	let avatarFile = $state<File | null>(null);
	let avatarPreview = $state<string | null>(null);
	let removeAvatar = $state(false);
	let fileInputEl: HTMLInputElement | undefined = $state();

	let displayedAvatarUrl = $derived.by(() => {
		if (removeAvatar) return null;
		if (avatarPreview) return avatarPreview;
		if (data.profile.image) return `/api/uploads/${data.profile.image}`;
		return null;
	});

	let initials = $derived(
		`${(data.profile.firstName || data.profile.name || '').charAt(0)}${(data.profile.lastName || '').charAt(0)}`.toUpperCase()
	);

	function handleAvatarSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/aiff'];
		if (!allowed.includes(file.type)) return;
		if (file.size > 2 * 1024 * 1024) return;

		avatarFile = file;
		removeAvatar = false;
		avatarPreview = URL.createObjectURL(file);
	}

	function handleRemoveAvatar() {
		avatarFile = null;
		if (avatarPreview) {
			URL.revokeObjectURL(avatarPreview);
			avatarPreview = null;
		}
		removeAvatar = true;
		if (fileInputEl) fileInputEl.value = '';
	}

	function v(field: string): string {
		return (form?.values as Record<string, string> | undefined)?.[field] ?? String((data.profile as unknown as Record<string, unknown>)[field] ?? '');
	}

	// Show toasts on form results
	$effect(() => {
		if (form?.success) {
			toast.success(form.message || 'Profile updated successfully');
		}
		if (form?.passwordSuccess) {
			toast.success(form.message || 'Password changed successfully');
		}
	});
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">My Profile</h1>
		<p class="text-muted-foreground">Manage your personal information and password</p>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- LEFT COLUMN: Single form for profile + avatar -->
		<form
			method="POST"
			action="?/updateProfile"
			enctype="multipart/form-data"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update }) => {
					await update();
					isSubmitting = false;
				};
			}}
			class="space-y-6"
		>
			<!-- Avatar + Account Card -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Account</Card.Title>
					<Card.Description>Your display name and email</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<!-- Avatar Upload -->
					<div class="flex flex-col items-center gap-2">
						<button
							type="button"
							class="relative group cursor-pointer"
							onclick={() => fileInputEl?.click()}
						>
							<Avatar.Root class="h-20 w-20">
								{#if displayedAvatarUrl}
									<Avatar.Image src={displayedAvatarUrl} alt="Your avatar" />
								{/if}
								<Avatar.Fallback class="text-lg">{initials || '?'}</Avatar.Fallback>
							</Avatar.Root>
							<div class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
								<Camera class="h-6 w-6 text-white" />
							</div>
						</button>
						<input
							bind:this={fileInputEl}
							type="file"
							name="avatar"
							accept=".jpg,.jpeg,.png,.webp,.aiff"
							class="hidden"
							onchange={handleAvatarSelect}
						/>
						{#if removeAvatar}
							<input type="hidden" name="removeAvatar" value="true" />
						{/if}
						{#if displayedAvatarUrl}
							<button
								type="button"
								class="text-xs text-muted-foreground hover:text-destructive cursor-pointer"
								onclick={handleRemoveAvatar}
							>
								Remove photo
							</button>
						{/if}
						<p class="text-xs text-muted-foreground">JPG, PNG, WebP or AIFF. Max 2MB.</p>
						{#if errors?.avatar}
							<p class="text-sm text-destructive">{errors.avatar}</p>
						{/if}
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="name">Display Name *</Label>
							<Input
								id="name"
								name="name"
								placeholder="Enter display name"
								value={v('name')}
								required
							/>
							{#if errors?.name}
								<p class="text-sm text-destructive">{errors.name}</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="email">Email *</Label>
							<Input
								id="email"
								name="email"
								type="email"
								placeholder="Enter email address"
								value={v('email')}
								required
							/>
							{#if errors?.email}
								<p class="text-sm text-destructive">{errors.email}</p>
							{/if}
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Personal Information Card -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Personal Information</Card.Title>
					<Card.Description>Your personal details</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="firstName">First Name</Label>
							<Input
								id="firstName"
								name="firstName"
								placeholder="Enter first name"
								value={v('firstName')}
							/>
						</div>

						<div class="space-y-2">
							<Label for="lastName">Last Name</Label>
							<Input
								id="lastName"
								name="lastName"
								placeholder="Enter last name"
								value={v('lastName')}
							/>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<Label for="phone">Phone</Label>
							<Input
								id="phone"
								name="phone"
								type="tel"
								placeholder="+1 (555) 123-4567"
								value={v('phone')}
							/>
						</div>

						<div class="space-y-2">
							<Label for="mobile">Mobile</Label>
							<Input
								id="mobile"
								name="mobile"
								type="tel"
								placeholder="+1 (555) 987-6543"
								value={v('mobile')}
							/>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="dateOfBirth">Date of Birth</Label>
						<Input
							id="dateOfBirth"
							name="dateOfBirth"
							type="date"
							value={v('dateOfBirth')}
						/>
					</div>

					<div class="space-y-2">
						<Label for="emergencyContact">Emergency Contact</Label>
						<Input
							id="emergencyContact"
							name="emergencyContact"
							placeholder="Name and phone number"
							value={v('emergencyContact')}
						/>
					</div>

					<div class="space-y-2">
						<Label for="notes">Notes</Label>
						<Textarea
							id="notes"
							name="notes"
							placeholder="Additional notes..."
							rows={3}
							value={v('notes')}
						/>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Address Card -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Address</Card.Title>
					<Card.Description>Your residential address</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="space-y-2">
						<Label for="street">Street Address</Label>
						<Input
							id="street"
							name="street"
							placeholder="123 Main Street"
							value={v('street')}
						/>
					</div>

					<div class="grid grid-cols-3 gap-4">
						<div class="space-y-2">
							<Label for="city">City</Label>
							<Input
								id="city"
								name="city"
								placeholder="City"
								value={v('city')}
							/>
						</div>

						<div class="space-y-2">
							<Label for="postalCode">Postal Code</Label>
							<Input
								id="postalCode"
								name="postalCode"
								placeholder="12345"
								value={v('postalCode')}
							/>
						</div>

						<div class="space-y-2">
							<Label for="country">Country</Label>
							<Input
								id="country"
								name="country"
								placeholder="Country"
								value={v('country')}
							/>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Saving...' : 'Save Changes'}
			</Button>
		</form>

		<!-- RIGHT COLUMN -->
		<div class="space-y-6">
			<!-- Employment Info (read-only) -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Employment Info</Card.Title>
					<Card.Description>Your employment details (managed by admin)</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-1">
							<p class="text-sm font-medium text-muted-foreground">Department</p>
							<p class="text-sm">{data.profile.department || '-'}</p>
						</div>
						<div class="space-y-1">
							<p class="text-sm font-medium text-muted-foreground">Job Title</p>
							<p class="text-sm">{data.profile.jobTitle || '-'}</p>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Change Password Card -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Change Password</Card.Title>
					<Card.Description>Update your login password</Card.Description>
				</Card.Header>
				<Card.Content>
					<form
						method="POST"
						action="?/changePassword"
						use:enhance={() => {
							isChangingPassword = true;
							return async ({ update }) => {
								await update();
								isChangingPassword = false;
							};
						}}
						class="space-y-4"
					>
						<div class="space-y-2">
							<Label for="currentPassword">Current Password *</Label>
							<Input
								id="currentPassword"
								name="currentPassword"
								type="password"
								placeholder="Enter current password"
								required
							/>
							{#if passwordErrors?.currentPassword}
								<p class="text-sm text-destructive">{passwordErrors.currentPassword}</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="newPassword">New Password *</Label>
							<Input
								id="newPassword"
								name="newPassword"
								type="password"
								placeholder="Enter new password (min 6 characters)"
								required
							/>
							{#if passwordErrors?.newPassword}
								<p class="text-sm text-destructive">{passwordErrors.newPassword}</p>
							{/if}
						</div>

						<div class="space-y-2">
							<Label for="confirmPassword">Confirm New Password *</Label>
							<Input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								placeholder="Confirm new password"
								required
							/>
							{#if passwordErrors?.confirmPassword}
								<p class="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
							{/if}
						</div>

						<Button type="submit" variant="outline" disabled={isChangingPassword}>
							{isChangingPassword ? 'Changing...' : 'Change Password'}
						</Button>
					</form>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
