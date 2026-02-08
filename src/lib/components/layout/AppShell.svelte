<script lang="ts">
	import { cn } from '$lib/utils';
	import Sidebar from './Sidebar.svelte';
	import Header from './Header.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import type { Snippet } from 'svelte';

	interface Props {
		user: { name: string; email: string } | null;
		permissions: Array<{ module: string; action: string }>;
		children: Snippet;
	}

	let { user, permissions, children }: Props = $props();

	let sidebarCollapsed = $state(false);

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}
</script>

<Tooltip.Provider>
	<div class="flex h-screen flex-col">
		<Header {user} {sidebarCollapsed} onToggleSidebar={toggleSidebar} />

		<div class="flex flex-1 overflow-hidden">
			<!-- Sidebar -->
			<aside
				class={cn(
					'flex flex-col border-r bg-sidebar transition-all duration-300',
					sidebarCollapsed ? 'w-14' : 'w-64'
				)}
			>
				<div class="flex-1 overflow-y-auto">
					<Sidebar {permissions} collapsed={sidebarCollapsed} />
				</div>
			</aside>

			<!-- Main content -->
			<main class="flex-1 overflow-y-auto bg-background p-6">
				{@render children()}
			</main>
		</div>
	</div>
</Tooltip.Provider>
