<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { ArrowLeft } from 'lucide-svelte';

	let { data, form } = $props();

	let isSubmitting = $state(false);
	let selectedGroups = $state<Set<string>>(
		new Set((form?.values?.groupIds || []).map((id: number | string) => String(id)))
	);

	// Type helper for form errors
	type FormErrors = Record<string, string> | undefined;
	const errors = $derived(form?.errors as FormErrors);

	// Employee field states
	let selectedEmploymentType = $state(form?.values?.employmentType || '');
	let selectedDepartment = $state(form?.values?.department || '');
	let selectedEmployeeStatus = $state(form?.values?.employeeStatus || 'active');

	function toggleGroup(groupId: string) {
		const newSet = new Set(selectedGroups);
		if (newSet.has(groupId)) {
			newSet.delete(groupId);
		} else {
			newSet.add(groupId);
		}
		selectedGroups = newSet;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/users">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<div>
			<h1 class="text-3xl font-bold tracking-tight">New User</h1>
			<p class="text-muted-foreground">Create a new system user</p>
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
		<!-- Hidden companyId -->
		{#if data.companyId}
			<input type="hidden" name="companyId" value={data.companyId} />
		{/if}

		<!-- Account Details -->
		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Account Details</Card.Title>
				<Card.Description>Login credentials and group memberships</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="name">Display Name *</Label>
						<Input
							id="name"
							name="name"
							placeholder="Enter display name"
							value={form?.values?.name || ''}
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
							value={form?.values?.email || ''}
							required
						/>
						{#if errors?.email}
							<p class="text-sm text-destructive">{errors.email}</p>
						{/if}
					</div>
				</div>

				<div class="space-y-2">
					<Label for="password">Password *</Label>
					<Input
						id="password"
						name="password"
						type="password"
						placeholder="Enter password"
						required
					/>
					{#if errors?.password}
						<p class="text-sm text-destructive">{errors.password}</p>
					{/if}
					<p class="text-sm text-muted-foreground">Minimum 6 characters</p>
				</div>

				<div class="space-y-3">
					<Label>User Groups</Label>
					<div class="grid gap-3">
						{#each data.userGroups as group}
							<label
								class="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
							>
								<Checkbox
									checked={selectedGroups.has(String(group.id))}
									onCheckedChange={() => toggleGroup(String(group.id))}
								/>
								<input
									type="checkbox"
									name="groups"
									value={String(group.id)}
									checked={selectedGroups.has(String(group.id))}
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
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Personal Information -->
		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Personal Information</Card.Title>
				<Card.Description>Employee's personal details</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="firstName">First Name</Label>
						<Input
							id="firstName"
							name="firstName"
							placeholder="Enter first name"
							value={form?.values?.firstName || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="lastName">Last Name</Label>
						<Input
							id="lastName"
							name="lastName"
							placeholder="Enter last name"
							value={form?.values?.lastName || ''}
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
							value={form?.values?.phone || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="mobile">Mobile</Label>
						<Input
							id="mobile"
							name="mobile"
							type="tel"
							placeholder="+1 (555) 987-6543"
							value={form?.values?.mobile || ''}
						/>
					</div>
				</div>

				<div class="space-y-2">
					<Label for="dateOfBirth">Date of Birth</Label>
					<Input
						id="dateOfBirth"
						name="dateOfBirth"
						type="date"
						value={form?.values?.dateOfBirth || ''}
					/>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Address -->
		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Address</Card.Title>
				<Card.Description>Employee's residential address</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="street">Street Address</Label>
					<Input
						id="street"
						name="street"
						placeholder="123 Main Street"
						value={form?.values?.street || ''}
					/>
				</div>

				<div class="grid grid-cols-3 gap-4">
					<div class="space-y-2">
						<Label for="city">City</Label>
						<Input
							id="city"
							name="city"
							placeholder="City"
							value={form?.values?.city || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="postalCode">Postal Code</Label>
						<Input
							id="postalCode"
							name="postalCode"
							placeholder="12345"
							value={form?.values?.postalCode || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="country">Country</Label>
						<Input
							id="country"
							name="country"
							placeholder="Country"
							value={form?.values?.country || ''}
						/>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Employment -->
		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Employment</Card.Title>
				<Card.Description>Employment details and role information</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="hireDate">Hire Date</Label>
						<Input
							id="hireDate"
							name="hireDate"
							type="date"
							value={form?.values?.hireDate || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="employmentType">Employment Type</Label>
						<Select.Root
							type="single"
							value={selectedEmploymentType}
							onValueChange={(v) => {
								if (v !== undefined) selectedEmploymentType = v;
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
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="department">Department</Label>
						<Select.Root
							type="single"
							value={selectedDepartment}
							onValueChange={(v) => {
								if (v !== undefined) selectedDepartment = v;
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

					<div class="space-y-2">
						<Label for="jobTitle">Job Title</Label>
						<Input
							id="jobTitle"
							name="jobTitle"
							placeholder="e.g. Software Engineer"
							value={form?.values?.jobTitle || ''}
						/>
					</div>
				</div>

				<div class="space-y-2">
					<Label for="employeeStatus">Employee Status</Label>
					<Select.Root
						type="single"
						value={selectedEmployeeStatus}
						onValueChange={(v) => {
							if (v !== undefined) selectedEmployeeStatus = v;
						}}
					>
						<Select.Trigger id="employeeStatus" class="w-full max-w-[250px]">
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
			</Card.Content>
		</Card.Root>

		<!-- Salary (permission-gated) -->
		{#if data.canManageSalary}
			<Card.Root class="max-w-2xl">
				<Card.Header>
					<Card.Title>Salary</Card.Title>
					<Card.Description>Compensation details (restricted access)</Card.Description>
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
								value={form?.values?.salary || ''}
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
								value={form?.values?.salary_tax || ''}
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
								value={form?.values?.salary_bonus || ''}
							/>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

		<div class="flex gap-4 max-w-2xl">
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Creating...' : 'Create User'}
			</Button>
			<Button type="button" variant="outline" href="/users">Cancel</Button>
		</div>
	</form>
</div>
