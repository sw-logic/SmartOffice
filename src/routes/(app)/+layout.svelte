<script lang="ts">
	import { AppShell } from '$lib/components/layout';

	let { data, children } = $props();
</script>

<AppShell user={data.user} permissions={data.permissions} enums={data.enums} employees={data.employees ?? []}>
	{@render children()}
</AppShell>
