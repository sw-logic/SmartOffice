<script lang="ts">
	import '../app.css';
	import { Toaster } from '$lib/components/ui/sonner';

	let { children } = $props();
</script>

<svelte:head>
	<title>Company Management</title>
	<meta name="description" content="Company Management System" />
</svelte:head>

{@render children()}
<Toaster />
