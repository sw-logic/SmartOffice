<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import MarkdownEditor from '$lib/components/shared/MarkdownEditor.svelte';
	import * as Dialog from '$lib/components/ui/dialog';

	interface MilestoneData {
		id?: number;
		name: string;
		description: string;
		date: string;
	}

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSubmit: (milestone: MilestoneData) => Promise<{ success: boolean; error?: string }>;
		milestone?: MilestoneData | null;
	}

	let {
		open = $bindable(),
		onOpenChange,
		onSubmit,
		milestone = null
	}: Props = $props();

	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	let name = $state('');
	let description = $state('');
	let date = $state('');

	let isEditing = $derived(!!milestone?.id);

	$effect(() => {
		if (open) {
			if (milestone) {
				name = milestone.name;
				description = milestone.description || '';
				date = milestone.date;
			} else {
				name = '';
				description = '';
				date = '';
			}
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
			const data: MilestoneData = {
				name: name.trim(),
				description: description.trim(),
				date
			};
			if (milestone?.id) {
				data.id = milestone.id;
			}

			const result = await onSubmit(data);

			if (result.success) {
				onOpenChange(false);
			} else {
				error = result.error || (isEditing ? 'Failed to update milestone' : 'Failed to create milestone');
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
	<Dialog.Content class="sm:max-w-[700px]">
		<Dialog.Header>
			<Dialog.Title>{isEditing ? 'Edit Milestone' : 'New Milestone'}</Dialog.Title>
			<Dialog.Description>
				{isEditing ? 'Update this milestone.' : 'Add a new milestone to this project.'}
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
			</div>

			<div class="space-y-2">
				<Label>Description</Label>
				<MarkdownEditor bind:value={description} placeholder="Optional description" />
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={isSubmitting}>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Milestone')}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
