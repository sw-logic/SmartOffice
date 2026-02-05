<script lang="ts">
	import { page } from '$app/stores';
	import { modules, filterModulesByPermissions, type Module } from '$config/modules';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { ChevronDown, ChevronRight } from 'lucide-svelte';

	interface Props {
		permissions: Array<{ module: string; action: string }>;
		collapsed?: boolean;
	}

	let { permissions, collapsed = false }: Props = $props();

	let expandedModules = $state<Set<string>>(new Set());

	const filteredModules = $derived(filterModulesByPermissions(permissions));
	const currentPath = $derived($page.url.pathname);

	function isActive(route: string, hasChildren: boolean = false): boolean {
		if (route === '/dashboard') {
			return currentPath === '/dashboard';
		}
		// For parent modules with children, only match exact route
		// Child routes will be handled by hasActiveChild
		if (hasChildren) {
			return currentPath === route;
		}
		// For leaf modules (no children), use startsWith for nested routes
		// but ensure it's a proper path segment match
		if (currentPath === route) {
			return true;
		}
		// Check if it's a sub-path (e.g., /users/groups/new matches /users/groups)
		return currentPath.startsWith(route + '/');
	}

	function toggleExpand(moduleId: string) {
		const newSet = new Set(expandedModules);
		if (newSet.has(moduleId)) {
			newSet.delete(moduleId);
		} else {
			newSet.add(moduleId);
		}
		expandedModules = newSet;
	}

	function hasActiveChild(module: Module): boolean {
		return module.subModules?.some(sub => isSubModuleActive(sub.route, module.subModules ?? [])) ?? false;
	}

	function isSubModuleActive(route: string, siblings: Array<{ route: string }>): boolean {
		// Exact match
		if (currentPath === route) {
			return true;
		}

		// Check if currentPath starts with this route
		if (!currentPath.startsWith(route + '/')) {
			return false;
		}

		// Check if any sibling is a better (longer prefix) match
		for (const sibling of siblings) {
			if (sibling.route !== route && sibling.route.length > route.length) {
				if (currentPath === sibling.route || currentPath.startsWith(sibling.route + '/')) {
					// Another sibling is a better match
					return false;
				}
			}
		}

		return true;
	}
</script>

<nav class="flex h-full flex-col gap-2 p-2">
	{#each filteredModules as module}
		{@const Icon = module.icon}
		{@const hasChildren = module.subModules && module.subModules.length > 0}
		{@const active = isActive(module.route, hasChildren)}
		{@const isExpanded = expandedModules.has(module.id) || hasActiveChild(module)}

		<div>
			{#if hasChildren}
				<Button
					variant={active || hasActiveChild(module) ? 'secondary' : 'ghost'}
					class={cn(
						'w-full justify-start gap-3',
						collapsed && 'justify-center px-2'
					)}
					onclick={() => toggleExpand(module.id)}
				>
					<Icon class="h-4 w-4 shrink-0" />
					{#if !collapsed}
						<span class="flex-1 text-left">{module.name}</span>
						{#if isExpanded}
							<ChevronDown class="h-4 w-4" />
						{:else}
							<ChevronRight class="h-4 w-4" />
						{/if}
					{/if}
				</Button>

				{#if isExpanded && !collapsed}
					<div class="ml-4 mt-1 flex flex-col gap-1 border-l pl-3">
						{#each module.subModules ?? [] as subModule}
							{@const SubIcon = subModule.icon}
							{@const subActive = isSubModuleActive(subModule.route, module.subModules ?? [])}
							<Button
								variant={subActive ? 'secondary' : 'ghost'}
								class="w-full justify-start gap-3"
								href={subModule.route}
							>
								<SubIcon class="h-4 w-4 shrink-0" />
								<span>{subModule.name}</span>
							</Button>
						{/each}
					</div>
				{/if}
			{:else}
				{#if collapsed}
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<a
									{...props}
									href={module.route}
									class={cn(
										'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 w-full px-2',
										active ? 'bg-secondary text-secondary-foreground' : 'hover:bg-accent hover:text-accent-foreground'
									)}
									style="height: 2.5rem;"
								>
									<Icon class="h-4 w-4" />
								</a>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="right">
							{module.name}
						</Tooltip.Content>
					</Tooltip.Root>
				{:else}
					<Button
						variant={active ? 'secondary' : 'ghost'}
						class="w-full justify-start gap-3"
						href={module.route}
					>
						<Icon class="h-4 w-4 shrink-0" />
						<span>{module.name}</span>
					</Button>
				{/if}
			{/if}
		</div>
	{/each}
</nav>
