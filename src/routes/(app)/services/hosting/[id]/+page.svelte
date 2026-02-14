<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Table from '$lib/components/ui/table';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import HostingSiteFormModal from '$lib/components/shared/HostingSiteFormModal.svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';
	import {
		ArrowLeft,
		Pencil,
		Trash2,
		RefreshCw,
		ExternalLink,
		Shield,
		ShieldAlert,
		ShieldX,
		WifiOff,
		CircleHelp,
		ArrowUpCircle,
		Building2,
		Globe,
		Server,
		Puzzle,
		Palette,
		LogIn,
		AlertTriangle
	} from 'lucide-svelte';

	let { data } = $props();

	let deleteDialogOpen = $state(false);
	let isDeleting = $state(false);
	let isSyncing = $state(false);
	let isLoggingIn = $state(false);
	let editModalOpen = $state(false);

	// Detailed data from sync endpoints
	let pluginData = $state<any>(null);
	let themeData = $state<any>(null);
	let healthData = $state<any>(null);
	let coreData = $state<any>(null);
	let loadingTab = $state<string | null>(null);

	// Error state for each tab
	let tabErrors = $state<Record<string, string | null>>({
		plugins: null,
		themes: null,
		health: null,
		core: null
	});

	function statusIcon(status: string) {
		switch (status) {
			case 'good': return Shield;
			case 'should_improve': return ShieldAlert;
			case 'critical': return ShieldX;
			case 'offline': return WifiOff;
			default: return CircleHelp;
		}
	}

	function statusColor(status: string): string {
		switch (status) {
			case 'good': return 'text-green-600';
			case 'should_improve': return 'text-yellow-600';
			case 'critical': return 'text-red-600';
			case 'offline': return 'text-gray-400';
			default: return 'text-muted-foreground';
		}
	}

	function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (status) {
			case 'good': return 'default';
			case 'should_improve': return 'secondary';
			case 'critical': return 'destructive';
			default: return 'outline';
		}
	}

	async function syncOverview() {
		isSyncing = true;
		try {
			const res = await fetch(`/api/hosting/${data.site.id}/sync`, { method: 'POST' });
			if (res.ok) {
				toast.success('Site synced');
				invalidateAll();
			} else {
				const err = await res.json().catch(() => ({}));
				toast.error(err.message || 'Sync failed');
			}
		} catch {
			toast.error('Connection failed');
		} finally {
			isSyncing = false;
		}
	}

	async function fetchTabData(endpoint: string) {
		loadingTab = endpoint;
		tabErrors[endpoint] = null;
		try {
			const res = await fetch(`/api/hosting/${data.site.id}/sync?endpoint=${endpoint}`, { method: 'POST' });
			if (res.ok) {
				const result = await res.json();
				switch (endpoint) {
					case 'plugins': pluginData = result.data; break;
					case 'themes': themeData = result.data; break;
					case 'health': healthData = result.data; break;
					case 'core': coreData = result.data; break;
				}
			} else {
				const err = await res.json().catch(() => ({}));
				const message = err.message || `Failed to fetch ${endpoint} data`;
				tabErrors[endpoint] = message;
				toast.error(message);
			}
		} catch {
			tabErrors[endpoint] = 'Connection failed — could not reach the server';
			toast.error('Connection failed');
		} finally {
			loadingTab = null;
		}
	}

	async function handleWpLogin() {
		isLoggingIn = true;
		try {
			const res = await fetch(`/api/hosting/${data.site.id}/login`, { method: 'POST' });
			if (res.ok) {
				const { loginUrl } = await res.json();
				window.open(loginUrl, '_blank');
			} else {
				const err = await res.json().catch(() => ({}));
				toast.error(err.message || 'Failed to generate login');
			}
		} catch {
			toast.error('Connection failed');
		} finally {
			isLoggingIn = false;
		}
	}

	function onTabChange(tab: string) {
		if (tab === 'plugins' && !pluginData) fetchTabData('plugins');
		else if (tab === 'themes' && !themeData) fetchTabData('themes');
		else if (tab === 'health' && !healthData) fetchTabData('health');
		else if (tab === 'system' && !coreData) fetchTabData('core');
	}

	const StatusIcon = $derived(statusIcon(data.site.status));
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" href="/services/hosting">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-3xl font-bold tracking-tight">{data.site.name}</h1>
					<Badge variant={statusBadgeVariant(data.site.status)}>
						{data.site.status === 'should_improve' ? 'Needs Attention' : data.site.status.charAt(0).toUpperCase() + data.site.status.slice(1)}
					</Badge>
				</div>
				<p class="text-muted-foreground">{data.site.domain}</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			{#if data.canUpdate}
				<Button variant="outline" onclick={handleWpLogin} disabled={isLoggingIn} title="Open WordPress admin in new tab">
					<LogIn class="mr-1 h-4 w-4" />
					{isLoggingIn ? 'Connecting...' : 'WP Admin'}
				</Button>
			{/if}
			<Button variant="outline" onclick={syncOverview} disabled={isSyncing}>
				<RefreshCw class="mr-1 h-4 w-4 {isSyncing ? 'animate-spin' : ''}" />
				Sync
			</Button>
			{#if data.canUpdate}
				<Button variant="outline" onclick={() => (editModalOpen = true)}>
					<Pencil class="mr-1 h-4 w-4" />
					Edit
				</Button>
			{/if}
			{#if data.canDelete}
				<Button variant="destructive" onclick={() => (deleteDialogOpen = true)}>
					<Trash2 class="mr-1 h-4 w-4" />
					Delete
				</Button>
			{/if}
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Sidebar -->
		<div class="space-y-6">
			<!-- Thumbnail -->
			{#if data.site.thumbnailPath}
				<a href="https://{data.site.domain}" target="_blank" class="block rounded-lg overflow-hidden border hover:shadow-md transition-shadow">
					<img
						src="/api/uploads/{data.site.thumbnailPath}"
						alt="{data.site.name} screenshot"
						class="w-full aspect-[16/9] object-cover object-top"
					/>
				</a>
			{/if}

			<!-- Status card -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Status</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-3 text-sm">
					<div class="flex items-center gap-2">
						<StatusIcon class="h-5 w-5 {statusColor(data.site.status)}" />
						<span class="font-medium capitalize">
							{data.site.status === 'should_improve' ? 'Needs Attention' : data.site.status}
						</span>
					</div>

					{#if data.site.totalUpdates > 0}
						<div class="flex items-center gap-2">
							<ArrowUpCircle class="h-4 w-4 text-amber-500" />
							<span>{data.site.totalUpdates} update{data.site.totalUpdates !== 1 ? 's' : ''} available</span>
						</div>
						<div class="ml-6 text-xs text-muted-foreground space-y-0.5">
							{#if data.site.coreUpdate}
								<p>WordPress core update</p>
							{/if}
							{#if data.site.pluginUpdates > 0}
								<p>{data.site.pluginUpdates} plugin update{data.site.pluginUpdates !== 1 ? 's' : ''}</p>
							{/if}
							{#if data.site.themeUpdates > 0}
								<p>{data.site.themeUpdates} theme update{data.site.themeUpdates !== 1 ? 's' : ''}</p>
							{/if}
						</div>
					{/if}

					{#if data.site.lastSyncError}
						<div class="text-destructive text-xs bg-destructive/10 rounded p-2">
							{data.site.lastSyncError}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Site info card -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Site Info</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-3 text-sm">
					<div class="flex items-start gap-2">
						<Globe class="h-4 w-4 text-muted-foreground mt-0.5" />
						<div>
							<p class="text-muted-foreground">Domain</p>
							<a
								href="https://{data.site.domain}"
								target="_blank"
								class="text-primary hover:underline font-medium inline-flex items-center gap-1"
							>
								{data.site.domain}
								<ExternalLink class="h-3 w-3" />
							</a>
						</div>
					</div>

					{#if data.site.wpVersion}
						<div class="flex items-start gap-2">
							<Server class="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p class="text-muted-foreground">WordPress</p>
								<p class="font-medium">
									{data.site.wpVersion}
									{#if data.site.coreUpdate}
										<Badge variant="secondary" class="ml-1 text-xs">Update available</Badge>
									{/if}
								</p>
							</div>
						</div>
					{/if}

					{#if data.site.phpVersion}
						<div class="flex items-start gap-2">
							<Server class="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p class="text-muted-foreground">PHP</p>
								<p class="font-medium">{data.site.phpVersion}</p>
							</div>
						</div>
					{/if}

					{#if data.site.client}
						<div class="flex items-start gap-2">
							<Building2 class="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p class="text-muted-foreground">Client</p>
								<a href="/clients/{data.site.client.id}" class="text-primary hover:underline font-medium">
									{data.site.client.name}
								</a>
							</div>
						</div>
					{/if}

					{#if data.site.service}
						<div class="flex items-start gap-2">
							<RefreshCw class="h-4 w-4 text-muted-foreground mt-0.5" />
							<div>
								<p class="text-muted-foreground">Linked Service</p>
								<a href="/services/{data.site.service.id}" class="text-primary hover:underline font-medium">
									{data.site.service.name}
								</a>
							</div>
						</div>
					{/if}

					<div class="pt-3 border-t text-muted-foreground">
						<p>Added {formatDate(data.site.createdAt)} by {data.site.createdBy.name}</p>
						{#if data.site.lastSyncAt}
							<p>Last synced {formatDate(data.site.lastSyncAt)}</p>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Main content with tabs -->
		<div class="lg:col-span-2">
			<Tabs.Root value="overview" onValueChange={onTabChange}>
				<Tabs.List>
					<Tabs.Trigger value="overview">Overview</Tabs.Trigger>
					<Tabs.Trigger value="plugins">
						Plugins
						{#if data.site.pluginUpdates > 0}
							<Badge variant="secondary" class="ml-1.5 h-5 px-1.5 text-xs">{data.site.pluginUpdates}</Badge>
						{/if}
					</Tabs.Trigger>
					<Tabs.Trigger value="themes">
						Themes
						{#if data.site.themeUpdates > 0}
							<Badge variant="secondary" class="ml-1.5 h-5 px-1.5 text-xs">{data.site.themeUpdates}</Badge>
						{/if}
					</Tabs.Trigger>
					<Tabs.Trigger value="health">Health</Tabs.Trigger>
					<Tabs.Trigger value="system">System</Tabs.Trigger>
				</Tabs.List>

				<!-- Overview Tab -->
				<Tabs.Content value="overview" class="mt-4 space-y-4">
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
						<Card.Root>
							<Card.Content class="pt-6 text-center">
								<p class="text-3xl font-bold {statusColor(data.site.status)}">
									{data.site.totalUpdates}
								</p>
								<p class="text-xs text-muted-foreground mt-1">Pending Updates</p>
							</Card.Content>
						</Card.Root>
						<Card.Root>
							<Card.Content class="pt-6 text-center">
								<p class="text-3xl font-bold">{data.site.activePlugins}</p>
								<p class="text-xs text-muted-foreground mt-1">Active Plugins</p>
							</Card.Content>
						</Card.Root>
						<Card.Root>
							<Card.Content class="pt-6 text-center">
								<p class="text-3xl font-bold">{data.site.wpVersion || '-'}</p>
								<p class="text-xs text-muted-foreground mt-1">WordPress</p>
							</Card.Content>
						</Card.Root>
						<Card.Root>
							<Card.Content class="pt-6 text-center">
								<p class="text-3xl font-bold">{data.site.phpVersion || '-'}</p>
								<p class="text-xs text-muted-foreground mt-1">PHP</p>
							</Card.Content>
						</Card.Root>
					</div>

					{#if data.site.status === 'unknown' && !data.site.lastSyncAt}
						<Card.Root>
							<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
								<RefreshCw class="h-8 w-8 text-muted-foreground mb-3" />
								<h3 class="font-semibold mb-2">Not synced yet</h3>
								<p class="text-muted-foreground text-sm mb-4">
									Click "Sync" to fetch the current status from {data.site.domain}
								</p>
								<Button onclick={syncOverview} disabled={isSyncing}>
									<RefreshCw class="mr-2 h-4 w-4 {isSyncing ? 'animate-spin' : ''}" />
									Sync Now
								</Button>
							</Card.Content>
						</Card.Root>
					{/if}
				</Tabs.Content>

				<!-- Plugins Tab -->
				<Tabs.Content value="plugins" class="mt-4">
					{#if loadingTab === 'plugins'}
						<div class="flex items-center justify-center py-12">
							<RefreshCw class="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					{:else if tabErrors.plugins}
					<Card.Root class="border-destructive">
						<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
							<AlertTriangle class="h-8 w-8 text-destructive mb-3" />
							<p class="text-destructive text-sm font-medium mb-1">Failed to fetch plugin data</p>
							<p class="text-muted-foreground text-xs mb-4 max-w-md">{tabErrors.plugins}</p>
							<Button variant="outline" size="sm" onclick={() => fetchTabData('plugins')}>
								<RefreshCw class="mr-1 h-3.5 w-3.5" />
								Retry
							</Button>
						</Card.Content>
					</Card.Root>
				{:else if pluginData?.plugins}
						<div class="flex items-center justify-between mb-3">
							<p class="text-sm text-muted-foreground">
								{pluginData.total} plugins, {pluginData.active} active, {pluginData.updates} with updates
							</p>
							<Button variant="ghost" size="sm" onclick={() => fetchTabData('plugins')}>
								<RefreshCw class="mr-1 h-3.5 w-3.5" />
								Refresh
							</Button>
						</div>
						<div class="rounded-md border">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Plugin</Table.Head>
										<Table.Head>Version</Table.Head>
										<Table.Head>Status</Table.Head>
										<Table.Head>Update</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each pluginData.plugins as plugin}
										<Table.Row>
											<Table.Cell>
												<div>
													<span class="font-medium">{plugin.name}</span>
													{#if plugin.author}
														<span class="text-xs text-muted-foreground ml-1">by {plugin.author}</span>
													{/if}
												</div>
											</Table.Cell>
											<Table.Cell class="text-sm">{plugin.version}</Table.Cell>
											<Table.Cell>
												<Badge variant={plugin.active ? 'default' : 'outline'}>
													{plugin.active ? 'Active' : 'Inactive'}
												</Badge>
											</Table.Cell>
											<Table.Cell>
												{#if plugin.update}
													<Badge variant="secondary" class="gap-1">
														<ArrowUpCircle class="h-3 w-3" />
														{plugin.new_version}
													</Badge>
												{:else}
													<span class="text-xs text-muted-foreground">Up to date</span>
												{/if}
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
					{:else}
						<Card.Root>
							<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
								<Puzzle class="h-8 w-8 text-muted-foreground mb-3" />
								<p class="text-muted-foreground text-sm">Click the tab to fetch plugin data from the site</p>
							</Card.Content>
						</Card.Root>
					{/if}
				</Tabs.Content>

				<!-- Themes Tab -->
				<Tabs.Content value="themes" class="mt-4">
					{#if loadingTab === 'themes'}
						<div class="flex items-center justify-center py-12">
							<RefreshCw class="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					{:else if tabErrors.themes}
					<Card.Root class="border-destructive">
						<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
							<AlertTriangle class="h-8 w-8 text-destructive mb-3" />
							<p class="text-destructive text-sm font-medium mb-1">Failed to fetch theme data</p>
							<p class="text-muted-foreground text-xs mb-4 max-w-md">{tabErrors.themes}</p>
							<Button variant="outline" size="sm" onclick={() => fetchTabData('themes')}>
								<RefreshCw class="mr-1 h-3.5 w-3.5" />
								Retry
							</Button>
						</Card.Content>
					</Card.Root>
				{:else if themeData?.themes}
						<div class="flex items-center justify-between mb-3">
							<p class="text-sm text-muted-foreground">
								{themeData.total} themes, {themeData.updates} with updates
							</p>
							<Button variant="ghost" size="sm" onclick={() => fetchTabData('themes')}>
								<RefreshCw class="mr-1 h-3.5 w-3.5" />
								Refresh
							</Button>
						</div>
						<div class="rounded-md border">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Theme</Table.Head>
										<Table.Head>Version</Table.Head>
										<Table.Head>Status</Table.Head>
										<Table.Head>Update</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each themeData.themes as theme}
										<Table.Row>
											<Table.Cell class="font-medium">{theme.name}</Table.Cell>
											<Table.Cell class="text-sm">{theme.version}</Table.Cell>
											<Table.Cell>
												<Badge variant={theme.active ? 'default' : 'outline'}>
													{theme.active ? 'Active' : 'Inactive'}
												</Badge>
											</Table.Cell>
											<Table.Cell>
												{#if theme.update}
													<Badge variant="secondary" class="gap-1">
														<ArrowUpCircle class="h-3 w-3" />
														{theme.new_version}
													</Badge>
												{:else}
													<span class="text-xs text-muted-foreground">Up to date</span>
												{/if}
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
					{:else}
						<Card.Root>
							<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
								<Palette class="h-8 w-8 text-muted-foreground mb-3" />
								<p class="text-muted-foreground text-sm">Click the tab to fetch theme data from the site</p>
							</Card.Content>
						</Card.Root>
					{/if}
				</Tabs.Content>

				<!-- Health Tab -->
				<Tabs.Content value="health" class="mt-4">
					{#if loadingTab === 'health'}
						<div class="flex items-center justify-center py-12">
							<RefreshCw class="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					{:else if tabErrors.health}
					<Card.Root class="border-destructive">
						<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
							<AlertTriangle class="h-8 w-8 text-destructive mb-3" />
							<p class="text-destructive text-sm font-medium mb-1">Failed to fetch health data</p>
							<p class="text-muted-foreground text-xs mb-4 max-w-md">{tabErrors.health}</p>
							<Button variant="outline" size="sm" onclick={() => fetchTabData('health')}>
								<RefreshCw class="mr-1 h-3.5 w-3.5" />
								Retry
							</Button>
						</Card.Content>
					</Card.Root>
				{:else if healthData}
						<div class="flex items-center justify-between mb-3">
							<div class="flex items-center gap-2">
								<p class="text-sm text-muted-foreground">Health score:</p>
								<Badge variant={statusBadgeVariant(healthData.status)}>
									{healthData.score}%
								</Badge>
							</div>
							<Button variant="ghost" size="sm" onclick={() => fetchTabData('health')}>
								<RefreshCw class="mr-1 h-3.5 w-3.5" />
								Refresh
							</Button>
						</div>

						<div class="grid grid-cols-3 gap-4 mb-4">
							<Card.Root>
								<Card.Content class="pt-4 text-center">
									<p class="text-2xl font-bold text-red-600">{healthData.counts.critical}</p>
									<p class="text-xs text-muted-foreground">Critical</p>
								</Card.Content>
							</Card.Root>
							<Card.Root>
								<Card.Content class="pt-4 text-center">
									<p class="text-2xl font-bold text-yellow-600">{healthData.counts.recommended}</p>
									<p class="text-xs text-muted-foreground">Recommended</p>
								</Card.Content>
							</Card.Root>
							<Card.Root>
								<Card.Content class="pt-4 text-center">
									<p class="text-2xl font-bold text-green-600">{healthData.counts.good}</p>
									<p class="text-xs text-muted-foreground">Passed</p>
								</Card.Content>
							</Card.Root>
						</div>

						{#if healthData.issues?.length > 0}
							<div class="rounded-md border">
								<Table.Root>
									<Table.Header>
										<Table.Row>
											<Table.Head>Check</Table.Head>
											<Table.Head>Category</Table.Head>
											<Table.Head>Status</Table.Head>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{#each healthData.issues as issue}
											<Table.Row>
												<Table.Cell class="font-medium">{issue.label}</Table.Cell>
												<Table.Cell class="text-sm text-muted-foreground">{issue.badge || '-'}</Table.Cell>
												<Table.Cell>
													{#if issue.status === 'critical'}
														<Badge variant="destructive">Critical</Badge>
													{:else if issue.status === 'recommended'}
														<Badge variant="secondary">Recommended</Badge>
													{:else}
														<Badge variant="default">Passed</Badge>
													{/if}
												</Table.Cell>
											</Table.Row>
										{/each}
									</Table.Body>
								</Table.Root>
							</div>
						{/if}
					{:else}
						<Card.Root>
							<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
								<Shield class="h-8 w-8 text-muted-foreground mb-3" />
								<p class="text-muted-foreground text-sm">Click the tab to run health checks on the site</p>
							</Card.Content>
						</Card.Root>
					{/if}
				</Tabs.Content>

				<!-- System Tab -->
				<Tabs.Content value="system" class="mt-4">
					{#if loadingTab === 'core'}
						<div class="flex items-center justify-center py-12">
							<RefreshCw class="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					{:else if tabErrors.core}
					<Card.Root class="border-destructive">
						<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
							<AlertTriangle class="h-8 w-8 text-destructive mb-3" />
							<p class="text-destructive text-sm font-medium mb-1">Failed to fetch system data</p>
							<p class="text-muted-foreground text-xs mb-4 max-w-md">{tabErrors.core}</p>
							<Button variant="outline" size="sm" onclick={() => fetchTabData('core')}>
								<RefreshCw class="mr-1 h-3.5 w-3.5" />
								Retry
							</Button>
						</Card.Content>
					</Card.Root>
				{:else if coreData}
						<div class="flex items-center justify-end mb-3">
							<Button variant="ghost" size="sm" onclick={() => fetchTabData('core')}>
								<RefreshCw class="mr-1 h-3.5 w-3.5" />
								Refresh
							</Button>
						</div>

						<div class="grid gap-4 md:grid-cols-2">
							<Card.Root>
								<Card.Header class="pb-2">
									<Card.Title class="text-sm">Server</Card.Title>
								</Card.Header>
								<Card.Content class="space-y-2 text-sm">
									<div class="flex justify-between">
										<span class="text-muted-foreground">WordPress</span>
										<span class="font-medium">
											{coreData.version}
											{#if coreData.update}
												<span class="text-amber-500 ml-1">({coreData.latest_version} available)</span>
											{/if}
										</span>
									</div>
									<div class="flex justify-between">
										<span class="text-muted-foreground">PHP</span>
										<span class="font-medium">{coreData.php_version}</span>
									</div>
									<div class="flex justify-between">
										<span class="text-muted-foreground">MySQL</span>
										<span class="font-medium">{coreData.mysql_version}</span>
									</div>
									<div class="flex justify-between">
										<span class="text-muted-foreground">Web Server</span>
										<span class="font-medium text-xs">{coreData.server}</span>
									</div>
									<div class="flex justify-between">
										<span class="text-muted-foreground">Multisite</span>
										<span class="font-medium">{coreData.multisite ? 'Yes' : 'No'}</span>
									</div>
								</Card.Content>
							</Card.Root>

							<Card.Root>
								<Card.Header class="pb-2">
									<Card.Title class="text-sm">Storage</Card.Title>
								</Card.Header>
								<Card.Content class="space-y-2 text-sm">
									<div class="flex justify-between">
										<span class="text-muted-foreground">Uploads</span>
										<span class="font-medium">{coreData.upload_size_hr}</span>
									</div>
									<div class="flex justify-between">
										<span class="text-muted-foreground">Database</span>
										<span class="font-medium">{coreData.db_size_hr}</span>
									</div>
									<div class="flex justify-between">
										<span class="text-muted-foreground">Active Plugins</span>
										<span class="font-medium">{coreData.active_plugins}</span>
									</div>
									{#if coreData.users}
										<div class="flex justify-between">
											<span class="text-muted-foreground">Users</span>
											<span class="font-medium">{coreData.users.total_users}</span>
										</div>
									{/if}
								</Card.Content>
							</Card.Root>

							<Card.Root class="md:col-span-2">
								<Card.Header class="pb-2">
									<Card.Title class="text-sm">URLs</Card.Title>
								</Card.Header>
								<Card.Content class="space-y-2 text-sm">
									<div class="flex justify-between">
										<span class="text-muted-foreground">Site URL</span>
										<a href={coreData.site_url} target="_blank" class="text-primary hover:underline inline-flex items-center gap-1">
											{coreData.site_url} <ExternalLink class="h-3 w-3" />
										</a>
									</div>
									<div class="flex justify-between">
										<span class="text-muted-foreground">Home URL</span>
										<a href={coreData.home_url} target="_blank" class="text-primary hover:underline inline-flex items-center gap-1">
											{coreData.home_url} <ExternalLink class="h-3 w-3" />
										</a>
									</div>
								</Card.Content>
							</Card.Root>
						</div>
					{:else}
						<Card.Root>
							<Card.Content class="flex flex-col items-center justify-center py-12 text-center">
								<Server class="h-8 w-8 text-muted-foreground mb-3" />
								<p class="text-muted-foreground text-sm">Click the tab to fetch system information</p>
							</Card.Content>
						</Card.Root>
					{/if}
				</Tabs.Content>
			</Tabs.Root>
		</div>
	</div>
</div>

<HostingSiteFormModal
	bind:open={editModalOpen}
	site={data.site}
	clients={data.clients}
	services={data.services}
	onsave={() => {
		editModalOpen = false;
		invalidateAll();
	}}
/>

<!-- Delete confirmation -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Hosting Site</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to permanently delete "{data.site.name}" ({data.site.domain})?
				This will remove the monitoring connection. The WordPress site itself will not be affected.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/delete"
				use:enhance={() => {
					isDeleting = true;
					return async ({ result }) => {
						isDeleting = false;
						if (result.type === 'success') {
							toast.success('Hosting site deleted');
							goto('/services/hosting');
						} else {
							toast.error('Failed to delete');
						}
					};
				}}
			>
				<input type="hidden" name="id" value={data.site.id} />
				<Button type="submit" variant="destructive" disabled={isDeleting}>
					{isDeleting ? 'Deleting...' : 'Delete'}
				</Button>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
