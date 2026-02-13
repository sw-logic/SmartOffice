<script lang="ts">
	import { signOut } from '@auth/sveltekit/client';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import UserAvatar from '$lib/components/shared/UserAvatar.svelte';
	import TimerWidget from '$lib/components/shared/TimerWidget.svelte';
	import { theme } from '$stores/theme';
	import { Moon, Sun, LogOut, User, Settings, PanelLeftClose, PanelLeft } from 'lucide-svelte';

	interface Props {
		user: { id?: number; name: string; email: string; image?: string | null } | null;
		sidebarCollapsed?: boolean;
		onToggleSidebar?: () => void;
		enums?: Record<string, any[]>;
		employees?: Array<{ id: number; firstName: string | null; lastName: string | null }>;
		currentUserId?: number | null;
	}

	let { user, sidebarCollapsed = false, onToggleSidebar, enums = {}, employees = [], currentUserId = null }: Props = $props();

	const resolvedTheme = $derived($theme === 'system' ? 'light' : $theme);

	function toggleTheme() {
		theme.toggle();
	}

	function handleSignOut() {
		signOut({ callbackUrl: '/login' });
	}

	function navigateToSettings() {
		window.location.href = '/settings';
	}
</script>

<header class="flex h-14 items-center gap-4 border-b bg-background px-4">
	<Button variant="ghost" size="icon" onclick={onToggleSidebar}>
		{#if sidebarCollapsed}
			<PanelLeft class="h-5 w-5" />
		{:else}
			<PanelLeftClose class="h-5 w-5" />
		{/if}
		<span class="sr-only">Toggle sidebar</span>
	</Button>

	<a href="/" class="flex-1">
		<img
			src="/assets/images/smart_office_light.svg"
			alt="SmartOffice"
			class="h-7 dark:hidden"
		/>
		<img
			src="/assets/images/smart_office_dark.svg"
			alt="SmartOffice"
			class="h-7 hidden dark:block"
		/>
	</a>

	<div class="flex items-center gap-2">
		<TimerWidget {enums} {employees} {currentUserId} />

		<Button variant="ghost" size="icon" onclick={toggleTheme}>
			{#if resolvedTheme === 'dark'}
				<Sun class="h-5 w-5" />
			{:else}
				<Moon class="h-5 w-5" />
			{/if}
			<span class="sr-only">Toggle theme</span>
		</Button>

		{#if user}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<button {...props} class="relative h-8 w-8 rounded-full">
							<UserAvatar user={user} size="lg" />
						</button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content class="w-56" align="end">
					<DropdownMenu.Label class="font-normal">
						<div class="flex flex-col space-y-1">
							<p class="text-sm font-medium leading-none">{user.name}</p>
							<p class="text-xs leading-none text-muted-foreground">{user.email}</p>
						</div>
					</DropdownMenu.Label>
					<DropdownMenu.Separator />
					<DropdownMenu.Item onSelect={() => { window.location.href = '/profile'; }}>
						<User class="mr-2 h-4 w-4" />
						Profile
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={navigateToSettings}>
						<Settings class="mr-2 h-4 w-4" />
						Settings
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item onSelect={handleSignOut}>
						<LogOut class="mr-2 h-4 w-4" />
						Sign out
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}
	</div>
</header>
