<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSubmit: (milestone: { name: string; description: string; date: string }) => Promise<{ success: boolean; error?: string }>;
	}

	let {
		open = $bindable(),
		onOpenChange,
		onSubmit
	}: Props = $props();

	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	let name = $state('');
	let description = $state('');
	let date = $state('');

	$effect(() => {
		if (open) {
			name = '';
			description = '';
			date = '';
			error = null;
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!name.trim()) {
			error = 'Name is required';
			return;
		}
		if (!date) {
			error = 'Date is required';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const result = await onSubmit({
				name: name.trim(),
				description: description.trim(),
				date
			});

			if (result.success) {
				onOpenChange(false);
			} else {
				error = result.error || 'Failed to create milestone';
			}
		} catch {
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
			<Dialog.Title>New Milestone</Dialog.Title>
			<Dialog.Description>
				Add a new milestone to this project.
			</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleSubmit} class="space-y-4">
			{#if error}
				<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<div class="space-y-2">
				<Label for="milestoneName">Name *</Label>
				<Input
					id="milestoneName"
					placeholder="Milestone name"
					bind:value={name}
					required
				/>
			</div>

			<div class="space-y-2">
				<Label for="milestoneDate">Date *</Label>
				<Input
					id="milestoneDate"
					type="date"
					bind:value={date}
					required
				/>
			</div>

			<div class="space-y-2">
				<Label for="milestoneDescription">Description</Label>
				<Textarea
					id="milestoneDescription"
					placeholder="Optional description"
					bind:value={description}
					rows={3}
				/>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={isSubmitting}>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Creating...' : 'Create Milestone'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
