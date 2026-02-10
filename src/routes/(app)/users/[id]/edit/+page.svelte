<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import * as Avatar from '$lib/components/ui/avatar';
	import { ArrowLeft, Camera } from 'lucide-svelte';

	let { data, form } = $props();

	let isSubmitting = $state(false);
	let selectedGroups = $state<Set<number>>(
		new Set(
			(form?.values?.groupIds || data.user.groupIds).map((id: string | number) =>
				typeof id === 'string' ? parseInt(id) : id
			)
		)
	);

	// Type helper for form errors
	type FormErrors = Record<string, string> | undefined;
	const errors = $derived(form?.errors as FormErrors);

	// Employee field states
	let selectedEmploymentType = $state(form?.values?.employmentType || data.user.employmentType || '');
	let selectedDepartment = $state(form?.values?.department || data.user.department || '');
	let selectedEmployeeStatus = $state(form?.values?.employeeStatus || data.user.employeeStatus || '');

	function toggleGroup(groupId: number) {
		const newSet = new Set(selectedGroups);
		if (newSet.has(groupId)) {
			newSet.delete(groupId);
		} else {
			newSet.add(groupId);
		}
		selectedGroups = newSet;
	}

	// Avatar state
	let avatarFile = $state<File | null>(null);
	let avatarPreview = $state<string | null>(null);
	let removeAvatar = $state(false);
	let fileInputEl: HTMLInputElement | undefined = $state();

	let displayedAvatarUrl = $derived.by(() => {
		if (removeAvatar) return null;
		if (avatarPreview) return avatarPreview;
		if (data.user.image) return `/api/uploads/${data.user.image}`;
		return null;
	});

	let initials = $derived(
		`${(data.user.firstName || data.user.name || '').charAt(0)}${(data.user.lastName || '').charAt(0)}`.toUpperCase()
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
		return (form?.values as Record<string, string> | undefined)?.[field] ?? String((data.user as unknown as Record<string, unknown>)[field] ?? '');
	}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/users/{data.user.id}">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Edit User</h1>
			<p class="text-muted-foreground">Update user information for {data.user.name}</p>
		</div>
	</div>

	<form
		method="POST"
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
		<!-- Hidden companyId -->
		{#if data.companyId}
			<input type="hidden" name="companyId" value={data.companyId} />
		{/if}

		<div class="grid gap-6 lg:grid-cols-2">
			<!-- LEFT COLUMN -->
			<div class="space-y-6">
				<!-- Account Details -->
				<Card.Root>
					<Card.Header>
						<Card.Title>Account Details</Card.Title>
						<Card.Description>Login credentials</Card.Description>
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
										<Avatar.Image src={displayedAvatarUrl} alt="User avatar" />
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

						<div class="space-y-2">
							<Label for="password">Password</Label>
							<Input
								id="password"
								name="password"
								type="password"
								placeholder="Enter new password (leave blank to keep current)"
							/>
							{#if errors?.password}
								<p class="text-sm text-destructive">{errors.password}</p>
							{/if}
							<p class="text-sm text-muted-foreground">Leave blank to keep the current password</p>
						</div>
					</Card.Content>
				</Card.Root>

				<!-- Personal Information -->
				<Card.Root>
					<Card.Header>
						<Card.Title>Personal Information</Card.Title>
						<Card.Description>Personal details</Card.Description>
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

				<!-- Address -->
				<Card.Root>
					<Card.Header>
						<Card.Title>Address</Card.Title>
						<Card.Description>Residential address</Card.Description>
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
			</div>

			<!-- RIGHT COLUMN -->
			<div class="space-y-6">
				<!-- Employment -->
				<Card.Root>
					<Card.Header>
						<Card.Title>Employment</Card.Title>
						<Card.Description>Employment details and role information</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-4">
						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Label for="jobTitle">Job Title</Label>
								<Input
									id="jobTitle"
									name="jobTitle"
									placeholder="e.g. Software Engineer"
									value={v('jobTitle')}
								/>
							</div>

							<div class="space-y-2">
								<Label for="department">Department</Label>
								<Select.Root
									type="single"
									value={selectedDepartment}
									onValueChange={(val) => {
										if (val !== undefined) selectedDepartment = val;
									}}
								>
									<Select.Trigger id="department" class="w-full">
										{data.enums.department.find((d) => d.value === selectedDepartment)?.label || 'Select department'}
									</Select.Trigger>
									<Select.Content>
										{#each data.enums.department as dept}
											<Select.Item value={dept.value}>{dept.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								<input type="hidden" name="department" value={selectedDepartment} />
							</div>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Label for="employmentType">Employment Type</Label>
								<Select.Root
									type="single"
									value={selectedEmploymentType}
									onValueChange={(val) => {
										if (val !== undefined) selectedEmploymentType = val;
									}}
								>
									<Select.Trigger id="employmentType" class="w-full">
										{data.enums.employment_type.find((e) => e.value === selectedEmploymentType)?.label || 'Select type'}
									</Select.Trigger>
									<Select.Content>
										{#each data.enums.employment_type as type}
											<Select.Item value={type.value}>{type.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								<input type="hidden" name="employmentType" value={selectedEmploymentType} />
							</div>

							<div class="space-y-2">
								<Label for="employeeStatus">Employee Status</Label>
								<Select.Root
									type="single"
									value={selectedEmployeeStatus}
									onValueChange={(val) => {
										if (val !== undefined) selectedEmployeeStatus = val;
									}}
								>
									<Select.Trigger id="employeeStatus" class="w-full">
										{data.enums.employee_status.find((s) => s.value === selectedEmployeeStatus)?.label || 'Select status'}
									</Select.Trigger>
									<Select.Content>
										{#each data.enums.employee_status as status}
											<Select.Item value={status.value}>{status.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								<input type="hidden" name="employeeStatus" value={selectedEmployeeStatus} />
							</div>
						</div>

						<div class="space-y-2">
							<Label for="hireDate">Hire Date</Label>
							<Input
								id="hireDate"
								name="hireDate"
								type="date"
								value={v('hireDate')}
							/>
						</div>
					</Card.Content>
				</Card.Root>

				<!-- Salary (permission-gated) -->
				{#if data.canManageSalary}
					<Card.Root>
						<Card.Header>
							<Card.Title>Compensation</Card.Title>
							<Card.Description>Salary details (restricted access)</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="grid grid-cols-3 gap-4">
								<div class="space-y-2">
									<Label for="salary">Base Salary</Label>
									<Input
										id="salary"
										name="salary"
										type="number"
										step="0.01"
										min="0"
										placeholder="0.00"
										value={form?.values?.salary ?? data.user.salary ?? ''}
									/>
								</div>

								<div class="space-y-2">
									<Label for="salary_tax">Salary Tax</Label>
									<Input
										id="salary_tax"
										name="salary_tax"
										type="number"
										step="0.01"
										min="0"
										placeholder="0.00"
										value={form?.values?.salary_tax ?? data.user.salary_tax ?? ''}
									/>
								</div>

								<div class="space-y-2">
									<Label for="salary_bonus">Salary Bonus</Label>
									<Input
										id="salary_bonus"
										name="salary_bonus"
										type="number"
										step="0.01"
										min="0"
										placeholder="0.00"
										value={form?.values?.salary_bonus ?? data.user.salary_bonus ?? ''}
									/>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				{/if}

				<!-- User Groups -->
				<Card.Root>
					<Card.Header>
						<Card.Title>User Groups</Card.Title>
						<Card.Description>Access control group memberships</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="grid gap-3">
							{#each data.userGroups as group}
								<label
									class="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
								>
									<Checkbox
										checked={selectedGroups.has(group.id)}
										onCheckedChange={() => toggleGroup(group.id)}
									/>
									<input
										type="checkbox"
										name="groups"
										value={group.id}
										checked={selectedGroups.has(group.id)}
										class="hidden"
									/>
									<div class="space-y-1">
										<p class="font-medium">{group.name}</p>
										{#if group.description}
											<p class="text-sm text-muted-foreground">{group.description}</p>
										{/if}
									</div>
								</label>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		</div>

		<div class="flex gap-4">
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Saving...' : 'Save Changes'}
			</Button>
			<Button type="button" variant="outline" href="/users/{data.user.id}">Cancel</Button>
		</div>
	</form>
</div>
