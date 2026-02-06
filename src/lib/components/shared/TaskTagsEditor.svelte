<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import { X, Plus } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface Tag {
		id: number;
		enumValueId: number;
		enumValue: {
			id: number;
			value: string;
			label: string;
			color: string | null;
		};
	}

	interface AvailableTag {
		id: number;
		value: string;
		label: string;
		color: string | null;
	}

	interface Props {
		taskId: number;
		tags: Tag[];
		availableTags: AvailableTag[];
		onTagsChange: (tags: Tag[]) => void;
	}

	let { taskId, tags, availableTags, onTagsChange }: Props = $props();

	let popoverOpen = $state(false);
	let isAdding = $state(false);

	let unusedTags = $derived(
		availableTags.filter(at => !tags.some(t => t.enumValueId === at.id))
	);

	async function addTag(enumValueId: number) {
		if (isAdding) return;
		isAdding = true;

		try {
			const res = await fetch(`/api/tasks/${taskId}/tags`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enumValueId })
			});

			if (res.ok) {
				const { tag } = await res.json();
				onTagsChange([...tags, tag]);
				toast.success('Tag added');
			} else {
				const data = await res.json();
				toast.error(data.error || 'Failed to add tag');
			}
		} catch {
			toast.error('Failed to add tag');
		} finally {
			isAdding = false;
		}
	}

	async function removeTag(entityTagId: number) {
		try {
			const res = await fetch(`/api/tasks/${taskId}/tags`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ entityTagId })
			});

			if (res.ok) {
				onTagsChange(tags.filter(t => t.id !== entityTagId));
				toast.success('Tag removed');
			} else {
				const data = await res.json();
				toast.error(data.error || 'Failed to remove tag');
			}
		} catch {
			toast.error('Failed to remove tag');
		}
	}
</script>

<div class="flex flex-wrap items-center gap-1.5">
	{#each tags as tag (tag.id)}
		<Badge
			variant="outline"
			class="gap-1 pr-1"
			style={tag.enumValue.color ? `border-color: ${tag.enumValue.color}; color: ${tag.enumValue.color}` : ''}
		>
			{tag.enumValue.label}
			<button
				type="button"
				class="ml-0.5 rounded-full hover:bg-muted p-0.5"
				onclick={() => removeTag(tag.id)}
			>
				<X class="h-3 w-3" />
			</button>
		</Badge>
	{/each}

	{#if unusedTags.length > 0}
		<Popover.Root bind:open={popoverOpen}>
			<Popover.Trigger>
				<Button variant="outline" size="sm" class="h-6 gap-1 text-xs">
					<Plus class="h-3 w-3" />
					Tag
				</Button>
			</Popover.Trigger>
			<Popover.Content class="w-48 p-0" align="start">
				<Command.Root>
					<Command.Input placeholder="Search tags..." />
					<Command.List>
						<Command.Empty>No tags found.</Command.Empty>
						<Command.Group>
							{#each unusedTags as tag (tag.id)}
								<Command.Item
									value={tag.label}
									onSelect={() => {
										addTag(tag.id);
										popoverOpen = false;
									}}
								>
									<div class="flex items-center gap-2">
										{#if tag.color}
											<span
												class="h-3 w-3 rounded-full shrink-0"
												style="background-color: {tag.color}"
											></span>
										{/if}
										{tag.label}
									</div>
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.List>
				</Command.Root>
			</Popover.Content>
		</Popover.Root>
	{/if}
</div>
