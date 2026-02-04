<script lang="ts">
	import { AppShell } from '$lib/components/layout';

	let { data, children } = $props();
</script>

<AppShell user={data.user} permissions={data.permissions}>
	{@render children()}
</AppShell>
