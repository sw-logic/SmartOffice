<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
	import type { Snippet } from "svelte";

	let { children, ...restProps }: AlertDialogPrimitive.TriggerProps & { children?: Snippet } = $props();
</script>

<AlertDialogPrimitive.Trigger {...restProps}>
	{@render children?.()}
</AlertDialogPrimitive.Trigger>
