<script lang="ts">
	import { cn } from '$lib/utils';
	import Sidebar from './Sidebar.svelte';
	import Header from './Header.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import type { Snippet } from 'svelte';

	interface Props {
		user: { id?: number; name: string; email: string; image?: string | null } | null;
		permissions: Array<{ module: string; action: string }>;
		enums?: Record<string, any[]>;
		employees?: Array<{ id: number; firstName: string | null; lastName: string | null }>;
		children: Snippet;
	}

	let { user, permissions, enums = {}, employees = [], children }: Props = $props();

	let sidebarCollapsed = $state(false);

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}
</script>

<Tooltip.Provider>
	<div class="flex h-screen flex-col">
		<Header {user} {sidebarCollapsed} onToggleSidebar={toggleSidebar} {enums} {employees} currentUserId={user?.id ?? null} />

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
