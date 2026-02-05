<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
	import { buttonVariants } from "$lib/components/ui/button/index.js";
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: AlertDialogPrimitive.CancelProps & { children?: Snippet } = $props();
</script>

<AlertDialogPrimitive.Cancel
	bind:ref
	class={cn(buttonVariants({ variant: "outline" }), className)}
	{...restProps}
>
	{@render children?.()}
</AlertDialogPrimitive.Cancel>
