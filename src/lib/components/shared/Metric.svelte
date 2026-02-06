<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils.js';

	let {
		icon: Icon,
		title,
		value,
		valueClass,
		class: className
	}: {
		icon: Component<{ class?: string }>;
		title: string;
		value: string | number;
		valueClass?: string;
		class?: string;
	} = $props();
</script>

<div class={cn("flex flex-col items-center gap-1 text-center", className)}>
	<Icon class="h-4 w-4 text-muted-foreground" />
	<span class="text-xs text-muted-foreground">{title}</span>
	<span class={cn("text-lg font-semibold", valueClass)}>{value}</span>
</div>
