<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';

	interface NoteData {
		content: string;
		priority: string;
		color?: string | null;
	}

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSubmit: (data: NoteData) => Promise<{ success: boolean; error?: string }>;
		note?: NoteData | null;
	}

	let {
		open = $bindable(),
		onOpenChange,
		onSubmit,
		note = null
	}: Props = $props();

	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	let content = $state('');
	let priority = $state('normal');

	const priorityOptions = [
		{ value: 'low', label: 'Low' },
		{ value: 'normal', label: 'Normal' },
		{ value: 'high', label: 'High' },
		{ value: 'urgent', label: 'Urgent' }
	];

	$effect(() => {
		if (open) {
			if (note) {
				content = note.content;
				priority = note.priority;
			} else {
				content = '';
				priority = 'normal';
			}
			error = null;
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!content.trim()) {
			error = 'Content is required';
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const result = await onSubmit({
				content: content.trim(),
				priority
			});

			if (result.success) {
				onOpenChange(false);
			} else {
				error = result.error || 'Failed to save note';
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
			<Dialog.Title>{note ? 'Edit Note' : 'New Note'}</Dialog.Title>
			<Dialog.Description>
				{note ? 'Update this note.' : 'Add a new note.'}
			</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleSubmit} class="space-y-4">
			{#if error}
				<div class="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<div class="space-y-2">
				<Label for="noteContent">Content *</Label>
				<Textarea
					id="noteContent"
					placeholder="Write your note..."
					bind:value={content}
					rows={5}
					required
				/>
			</div>

			<div class="space-y-2">
				<Label for="notePriority">Priority</Label>
				<Select.Root type="single" value={priority} onValueChange={(v) => { if (v) priority = v; }}>
					<Select.Trigger id="notePriority">
						{priorityOptions.find(o => o.value === priority)?.label || 'Normal'}
					</Select.Trigger>
					<Select.Content>
						{#each priorityOptions as option}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => handleOpenChange(false)} disabled={isSubmitting}>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Saving...' : note ? 'Save Changes' : 'Add Note'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
