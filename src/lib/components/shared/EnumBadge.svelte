<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';

	interface EnumOption {
		value: string;
		label: string;
		color?: string | null;
	}

	interface Props {
		enums: EnumOption[];
		value: string;
		class?: string;
		[key: string]: unknown;
	}

	let { enums, value, class: className, ...restProps }: Props = $props();

	let matched = $derived(enums?.find((e) => e.value === value));
	let label = $derived(matched?.label ?? value);
	let color = $derived(matched?.color);
</script>

{#if color}
	<Badge
		variant="outline"
		class={className}
		style="background-color: {color}; color: white; border-color: transparent"
		{...restProps}
	>
		{label}
	</Badge>
{:else}
	<Badge variant="outline" class={className} {...restProps}>
		{label}
	</Badge>
{/if}
