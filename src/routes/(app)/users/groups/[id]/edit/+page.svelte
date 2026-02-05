<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Card from '$lib/components/ui/card';
	import * as Alert from '$lib/components/ui/alert';
	import { ArrowLeft, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-svelte';

	let { data, form } = $props();

	let isSubmitting = $state(false);
	let selectedPermissions = $state<Set<string>>(
		new Set((form?.values?.permissionIds || data.group.permissionIds).map((id: number | string) => String(id)))
	);
	let expandedModules = $state<Set<string>>(new Set());

	function togglePermission(permissionId: string) {
		const newSet = new Set(selectedPermissions);
		if (newSet.has(permissionId)) {
			newSet.delete(permissionId);
		} else {
			newSet.add(permissionId);
		}
		selectedPermissions = newSet;
	}

	function toggleModule(module: string) {
		const newSet = new Set(expandedModules);
		if (newSet.has(module)) {
			newSet.delete(module);
		} else {
			newSet.add(module);
		}
		expandedModules = newSet;
	}

	function selectAllInModule(module: string) {
		const newSet = new Set(selectedPermissions);
		const modulePermissions = data.groupedPermissions[module] || [];
		const allSelected = modulePermissions.every(p => selectedPermissions.has(String(p.id)));

		if (allSelected) {
			// Deselect all
			modulePermissions.forEach(p => newSet.delete(String(p.id)));
		} else {
			// Select all
			modulePermissions.forEach(p => newSet.add(String(p.id)));
		}
		selectedPermissions = newSet;
	}

	function isModuleFullySelected(module: string): boolean {
		const modulePermissions = data.groupedPermissions[module] || [];
		return modulePermissions.length > 0 && modulePermissions.every(p => selectedPermissions.has(String(p.id)));
	}

	function isModulePartiallySelected(module: string): boolean {
		const modulePermissions = data.groupedPermissions[module] || [];
		const selectedCount = modulePermissions.filter(p => selectedPermissions.has(String(p.id))).length;
		return selectedCount > 0 && selectedCount < modulePermissions.length;
	}

	function formatModuleName(module: string): string {
		return module.split('.').map(part =>
			part.charAt(0).toUpperCase() + part.slice(1)
		).join(' > ');
	}

	function formatActionName(action: string): string {
		return action.charAt(0).toUpperCase() + action.slice(1);
	}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/users/groups">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Edit User Group</h1>
			<p class="text-muted-foreground">Update group details and permissions</p>
		</div>
	</div>

	{#if data.group.isDeleted}
		<Alert.Root variant="destructive" class="max-w-2xl">
			<AlertTriangle class="h-4 w-4" />
			<Alert.Title>Deleted Group</Alert.Title>
			<Alert.Description>
				This group has been deleted. You can edit its details, but it won't be available for assignment until restored.
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
				<Card.Title>Group Details</Card.Title>
				<Card.Description>Update the basic information for this group</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="name">Name</Label>
					<Input
						id="name"
						name="name"
						placeholder="Enter group name"
						value={form?.values?.name || data.group.name}
						required
					/>
					{#if form?.errors?.name}
						<p class="text-sm text-destructive">{form.errors.name}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="description">Description</Label>
					<Textarea
						id="description"
						name="description"
						placeholder="Enter group description (optional)"
						value={form?.values?.description || data.group.description || ''}
						rows={3}
					/>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Permissions</Card.Title>
				<Card.Description>
					Select the permissions for this group ({selectedPermissions.size} selected)
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="space-y-2">
					{#each Object.entries(data.groupedPermissions) as [module, permissions]}
						<div class="rounded-lg border">
							<button
								type="button"
								class="flex w-full items-center justify-between p-3 hover:bg-muted/50"
								onclick={() => toggleModule(module)}
							>
								<div class="flex items-center gap-3">
									<Checkbox
										checked={isModuleFullySelected(module)}
										indeterminate={isModulePartiallySelected(module)}
										onCheckedChange={() => selectAllInModule(module)}
										onclick={(e) => e.stopPropagation()}
									/>
									<span class="font-medium">{formatModuleName(module)}</span>
									<span class="text-sm text-muted-foreground">
										({permissions.filter(p => selectedPermissions.has(String(p.id))).length}/{permissions.length})
									</span>
								</div>
								{#if expandedModules.has(module)}
									<ChevronDown class="h-4 w-4" />
								{:else}
									<ChevronRight class="h-4 w-4" />
								{/if}
							</button>

							{#if expandedModules.has(module)}
								<div class="border-t px-3 py-2 space-y-2">
									{#each permissions as permission}
										<label
											class="flex items-start gap-3 p-2 rounded cursor-pointer hover:bg-muted/50"
										>
											<Checkbox
												checked={selectedPermissions.has(String(permission.id))}
												onCheckedChange={() => togglePermission(String(permission.id))}
											/>
											<input
												type="checkbox"
												name="permissions"
												value={String(permission.id)}
												checked={selectedPermissions.has(String(permission.id))}
												class="hidden"
											/>
											<div class="space-y-1">
												<p class="font-medium text-sm">
													{formatActionName(permission.action)}
												</p>
												{#if permission.description}
													<p class="text-xs text-muted-foreground">{permission.description}</p>
												{/if}
											</div>
										</label>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>

		<div class="flex gap-4 max-w-2xl">
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Saving...' : 'Save Changes'}
			</Button>
			<Button type="button" variant="outline" href="/users/groups">Cancel</Button>
		</div>
	</form>
</div>
