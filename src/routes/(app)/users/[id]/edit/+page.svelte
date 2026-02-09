<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Card from '$lib/components/ui/card';
	import { ArrowLeft } from 'lucide-svelte';

	let { data, form } = $props();

	let isSubmitting = $state(false);
	let selectedGroups = $state<Set<number>>(
		new Set((form?.values?.groupIds || data.user.groupIds).map((id: string | number) => typeof id === 'string' ? parseInt(id) : id))
	);

	// Type helper for form errors
	type FormErrors = Record<string, string> | undefined;
	const errors = $derived(form?.errors as FormErrors);

	function toggleGroup(groupId: number) {
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
			<h1 class="text-3xl font-bold tracking-tight">Edit User</h1>
			<p class="text-muted-foreground">Update user information</p>
		</div>
	</div>


	<Card.Root class="max-w-2xl">
		<Card.Header>
			<Card.Title>User Details</Card.Title>
			<Card.Description>Update the user's information and group memberships</Card.Description>
		</Card.Header>
		<Card.Content>
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
				<div class="space-y-2">
					<Label for="name">Name</Label>
					<Input
						id="name"
						name="name"
						placeholder="Enter full name"
						value={form?.values?.name || data.user.name}
						required
					/>
					{#if errors?.name}
						<p class="text-sm text-destructive">{errors.name}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="email">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						placeholder="Enter email address"
						value={form?.values?.email || data.user.email}
						required
					/>
					{#if errors?.email}
						<p class="text-sm text-destructive">{errors.email}</p>
					{/if}
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

				<div class="space-y-3">
					<Label>User Groups</Label>
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
				</div>

				<div class="flex gap-4">
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? 'Saving...' : 'Save Changes'}
					</Button>
					<Button type="button" variant="outline" href="/users">Cancel</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
