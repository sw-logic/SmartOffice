<script lang="ts">
	import '../app.css'; // Tailwind styles
	import '../styles/app.scss'; // Custom styles for the application
	import { Toaster } from '$lib/components/ui/sonner';

	let { children } = $props();
</script>

<svelte:head>
	<title>Company Management</title>
	<meta name="description" content="Company Management System" />
</svelte:head>

{@render children()}
<Toaster expand={true} />
