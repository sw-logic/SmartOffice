<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';

	let {
		open = $bindable(false),
		title = 'Delete',
		name,
		isDeleting,
		onconfirm
	}: {
		open: boolean;
		title?: string;
		name?: string;
		isDeleting: boolean;
		onconfirm: () => void;
	} = $props();
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{title}</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete {#if name}<strong>{name}</strong>{:else}this item{/if}? This action cannot be undone.
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
