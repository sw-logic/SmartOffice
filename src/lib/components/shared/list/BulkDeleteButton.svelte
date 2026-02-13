<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Trash2 } from 'lucide-svelte';

	let {
		count,
		noun = 'item',
		isDeleting,
		onconfirm
	}: {
		count: number;
		noun?: string;
		isDeleting: boolean;
		onconfirm: () => void;
	} = $props();

	let dialogOpen = $state(false);
	let plural = $derived(count === 1 ? noun : noun + 's');
</script>

{#if count > 0}
	<Button variant="destructive" size="sm" onclick={() => (dialogOpen = true)}>
		<Trash2 class="mr-2 h-4 w-4" />
		Delete {count} {plural}
	</Button>
{/if}

<AlertDialog.Root bind:open={dialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete {count} {plural}</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete {count} {plural}? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				onclick={onconfirm}
				disabled={isDeleting}
			>
				{isDeleting ? 'Deleting...' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
