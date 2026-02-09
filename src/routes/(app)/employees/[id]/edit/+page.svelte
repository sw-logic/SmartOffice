<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { ArrowLeft } from 'lucide-svelte';

	let { data, form } = $props();

	let isSubmitting = $state(false);

	// Get default status from enums
	const defaultStatus = data.enums.employee_status.find((s) => s.isDefault)?.value || 'active';

	let selectedEmploymentType = $state(
		form?.values?.employmentType || data.employee.employmentType || ''
	);
	let selectedStatus = $state(
		form?.values?.employeeStatus || data.employee.employeeStatus || defaultStatus
	);
	let selectedDepartment = $state(form?.values?.department || data.employee.department || '');
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/employees/{data.employee.id}">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Edit Employee</h1>
			<p class="text-muted-foreground">
				Update information for {data.employee.firstName}
				{data.employee.lastName}
			</p>
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
				<Card.Title>Personal Information</Card.Title>
				<Card.Description>Basic contact details</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="firstName">First Name *</Label>
						<Input
							id="firstName"
							name="firstName"
							placeholder="John"
							value={form?.values?.firstName || data.employee.firstName}
							required
						/>
						{#if form?.errors?.firstName}
							<p class="text-sm text-destructive">{form.errors.firstName}</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="lastName">Last Name *</Label>
						<Input
							id="lastName"
							name="lastName"
							placeholder="Doe"
							value={form?.values?.lastName || data.employee.lastName}
							required
						/>
						{#if form?.errors?.lastName}
							<p class="text-sm text-destructive">{form.errors.lastName}</p>
						{/if}
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input
							id="email"
							name="email"
							type="email"
							placeholder="john.doe@company.com"
							value={form?.values?.email || data.employee.email || ''}
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
							value={form?.values?.phone || data.employee.phone || ''}
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="mobile">Mobile</Label>
						<Input
							id="mobile"
							name="mobile"
							type="tel"
							placeholder="+1 (555) 987-6543"
							value={form?.values?.mobile || data.employee.mobile || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="dateOfBirth">Date of Birth</Label>
						<Input
							id="dateOfBirth"
							name="dateOfBirth"
							type="date"
							value={form?.values?.dateOfBirth || data.employee.dateOfBirth || ''}
						/>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Address</Card.Title>
				<Card.Description>Employee's home address</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="street">Street Address</Label>
					<Input
						id="street"
						name="street"
						placeholder="123 Main Street"
						value={form?.values?.street || data.employee.street || ''}
					/>
				</div>

				<div class="grid grid-cols-3 gap-4">
					<div class="space-y-2">
						<Label for="city">City</Label>
						<Input
							id="city"
							name="city"
							placeholder="City"
							value={form?.values?.city || data.employee.city || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="postalCode">Postal Code</Label>
						<Input
							id="postalCode"
							name="postalCode"
							placeholder="12345"
							value={form?.values?.postalCode || data.employee.postalCode || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="country">Country</Label>
						<Input
							id="country"
							name="country"
							placeholder="Country"
							value={form?.values?.country || data.employee.country || ''}
						/>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Employment Details</Card.Title>
				<Card.Description>Job and contract information</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<Label for="jobTitle">Job Title</Label>
						<Input
							id="jobTitle"
							name="jobTitle"
							placeholder="Software Engineer"
							value={form?.values?.jobTitle || data.employee.jobTitle || ''}
						/>
					</div>

					<div class="space-y-2">
						<Label for="department">Department</Label>
						<Select.Root type="single" bind:value={selectedDepartment} name="department">
							<Select.Trigger>
								{data.enums.department.find((d) => d.value === selectedDepartment)?.label ||
									'Select department'}
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
						<Select.Root type="single" bind:value={selectedEmploymentType} name="employmentType">
							<Select.Trigger>
								{data.enums.employment_type.find((t) => t.value === selectedEmploymentType)?.label ||
									'Select type'}
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
						<Label for="employeeStatus">Status</Label>
						<Select.Root type="single" bind:value={selectedStatus} name="employeeStatus">
							<Select.Trigger>
								{data.enums.employee_status.find((s) => s.value === selectedStatus)?.label || 'Select status'}
							</Select.Trigger>
							<Select.Content>
								{#each data.enums.employee_status as status}
									<Select.Item value={status.value}>{status.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<input type="hidden" name="employeeStatus" value={selectedStatus} />
					</div>
				</div>

				<div class="space-y-2">
					<Label for="hireDate">Hire Date</Label>
					<Input
						id="hireDate"
						name="hireDate"
						type="date"
						value={form?.values?.hireDate || data.employee.hireDate || ''}
					/>
				</div>
			</Card.Content>
		</Card.Root>

		{#if data.canManageSalary}
			<Card.Root class="max-w-2xl">
				<Card.Header>
					<Card.Title>Compensation</Card.Title>
					<Card.Description>Salary and compensation details (restricted)</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="grid grid-cols-3 gap-4">
						<div class="space-y-2">
							<Label for="salary">Base Salary (USD)</Label>
							<Input
								id="salary"
								name="salary"
								type="number"
								step="0.01"
								min="0"
								placeholder="50000.00"
								value={form?.values?.salary || data.employee.salary || ''}
							/>
						</div>

						<div class="space-y-2">
							<Label for="salaryTax">Tax Withholding</Label>
							<Input
								id="salaryTax"
								name="salaryTax"
								type="number"
								step="0.01"
								min="0"
								placeholder="0.00"
								value={form?.values?.salaryTax || data.employee.salary_tax || ''}
							/>
						</div>

						<div class="space-y-2">
							<Label for="salaryBonus">Bonus</Label>
							<Input
								id="salaryBonus"
								name="salaryBonus"
								type="number"
								step="0.01"
								min="0"
								placeholder="0.00"
								value={form?.values?.salaryBonus || data.employee.salary_bonus || ''}
							/>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

		<Card.Root class="max-w-2xl">
			<Card.Header>
				<Card.Title>Additional Information</Card.Title>
				<Card.Description>Emergency contact and notes</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="emergencyContact">Emergency Contact</Label>
					<Input
						id="emergencyContact"
						name="emergencyContact"
						placeholder="Name - Phone Number"
						value={form?.values?.emergencyContact || data.employee.emergencyContact || ''}
					/>
				</div>

				<div class="space-y-2">
					<Label for="notes">Notes</Label>
					<Textarea
						id="notes"
						name="notes"
						placeholder="Additional notes about this employee..."
						rows={4}
						value={form?.values?.notes || data.employee.notes || ''}
					/>
				</div>
			</Card.Content>
		</Card.Root>

		<div class="flex gap-4 max-w-2xl">
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Saving...' : 'Save Changes'}
			</Button>
			<Button type="button" variant="outline" href="/employees/{data.employee.id}">Cancel</Button>
		</div>
	</form>
</div>
