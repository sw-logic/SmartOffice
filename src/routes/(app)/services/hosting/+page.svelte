<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Card from '$lib/components/ui/card';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { DeleteConfirmDialog } from '$lib/components/shared/list';
	import HostingSiteFormModal from '$lib/components/shared/HostingSiteFormModal.svelte';
	import {
		Plus,
		Trash2,
		RefreshCw,
		Globe,
		Shield,
		ShieldAlert,
		ShieldX,
		WifiOff,
		CircleHelp,
		ArrowUpCircle
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	// Form modal
	let formModalOpen = $state(false);
	let editingSite = $state<typeof data.sites[0] | null>(null);

	// Single delete
	let deleteDialogOpen = $state(false);
	let siteToDelete = $state<{ id: number; name: string } | null>(null);
	let isDeleting = $state(false);

	// Bulk delete
	let selectedIds = $state<Set<number>>(new Set());
	let bulkDeleteDialogOpen = $state(false);
	let isBulkDeleting = $state(false);

	// Sync state
	let syncingIds = $state<Set<number>>(new Set());
	let syncAllLoading = $state(false);

	let allSelected = $derived(data.sites.length > 0 && selectedIds.size === data.sites.length);
	let someSelected = $derived(selectedIds.size > 0 && selectedIds.size < data.sites.length);

	function toggleSelectAll() {
		if (allSelected) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(data.sites.map((s) => s.id));
		}
	}

	function toggleSelect(id: number) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

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

	function confirmDelete(site: { id: number; name: string }) {
		siteToDelete = site;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		if (!siteToDelete) return;
		isDeleting = true;
		const formData = new FormData();
		formData.append('id', String(siteToDelete.id));

		const response = await fetch('?/delete', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.type === 'success') {
			toast.success('Hosting site deleted');
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete');
		}

		isDeleting = false;
		deleteDialogOpen = false;
		siteToDelete = null;
	}

	async function handleBulkDelete() {
		isBulkDeleting = true;
		const formData = new FormData();
		formData.append('ids', Array.from(selectedIds).join(','));

		const response = await fetch('?/bulkDelete', { method: 'POST', body: formData });
		const result = await response.json();

		if (result.type === 'success') {
			toast.success(`${result.data.count} site(s) deleted`);
			selectedIds = new Set();
			invalidateAll();
		} else {
			toast.error(result.data?.error || 'Failed to delete');
		}

		isBulkDeleting = false;
		bulkDeleteDialogOpen = false;
	}

	async function syncSite(siteId: number) {
		const next = new Set(syncingIds);
		next.add(siteId);
		syncingIds = next;

		try {
			const res = await fetch(`/api/hosting/${siteId}/sync`, { method: 'POST' });
			if (res.ok) {
				toast.success('Site synced');
				invalidateAll();
			} else {
				const err = await res.json().catch(() => ({}));
				toast.error(err.message || `Sync failed (${res.status})`);
			}
		} catch {
			toast.error('Connection failed');
		} finally {
			const next = new Set(syncingIds);
			next.delete(siteId);
			syncingIds = next;
		}
	}

	async function syncAll() {
		syncAllLoading = true;
		const promises = data.sites.map((s) => syncSite(s.id));
		await Promise.allSettled(promises);
		syncAllLoading = false;
	}

	function openAddModal() {
		editingSite = null;
		formModalOpen = true;
	}

	function openEditModal(site: typeof data.sites[0]) {
		editingSite = site;
		formModalOpen = true;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Hosting</h1>
			<p class="text-muted-foreground">Monitor WordPress sites connected via SmartOffice Connector</p>
		</div>
		<div class="flex items-center gap-2">
			{#if selectedIds.size > 0 && data.canDelete}
				<Button variant="destructive" onclick={() => (bulkDeleteDialogOpen = true)}>
					<Trash2 class="mr-2 h-4 w-4" />
					Delete ({selectedIds.size})
				</Button>
			{/if}
			{#if data.sites.length > 0}
				<Button variant="outline" onclick={syncAll} disabled={syncAllLoading}>
					<RefreshCw class="mr-2 h-4 w-4 {syncAllLoading ? 'animate-spin' : ''}" />
					Sync All
				</Button>
			{/if}
			{#if data.canCreate}
				<Button onclick={openAddModal}>
					<Plus class="mr-2 h-4 w-4" />
					Add Site
				</Button>
			{/if}
		</div>
	</div>

	{#if data.sites.length === 0}
		<Card.Root>
			<Card.Content class="flex flex-col items-center justify-center py-16 text-center">
				<Globe class="h-12 w-12 text-muted-foreground mb-4" />
				<h3 class="text-lg font-semibold mb-2">No hosting sites yet</h3>
				<p class="text-muted-foreground mb-4">
					Add a WordPress site with the SmartOffice Connector plugin installed to start monitoring.
				</p>
				{#if data.canCreate}
					<Button onclick={openAddModal}>
						<Plus class="mr-2 h-4 w-4" />
						Add Site
					</Button>
				{/if}
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{#each data.sites as site}
				{@const StatusIcon = statusIcon(site.status)}
				{@const isSyncing = syncingIds.has(site.id)}
				<Card.Root class="cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden">
					{#if data.canDelete}
						<div class="absolute top-1 right-1 z-10" onclick={(e) => e.stopPropagation()}>
							<Checkbox
								checked={selectedIds.has(site.id)}
								onCheckedChange={() => toggleSelect(site.id)}
							/>
						</div>
					{/if}
					<div onclick={() => goto(`/services/hosting/${site.id}`)}>

						<Card.Header class="pb-3">
                            <div class="grid grid-cols-2">
                                <!-- Site Title -->
                                <div>
                                    <div class="flex items-start gap-3 pr-8">
                                        <div class="mt-0.5 {statusColor(site.status)}">
                                            <StatusIcon class="h-5 w-5"/>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <Card.Title class="text-base truncate">{site.name}</Card.Title>
                                            <p class="text-sm text-muted-foreground truncate">{site.domain}</p>
                                            <hr class="my-3">
                                            <Badge variant={statusBadgeVariant(site.status)}>
                                                {site.status === 'should_improve' ? 'Needs Attention' : site.status.charAt(0).toUpperCase() + site.status.slice(1)}
                                            </Badge>
                                            {#if site.totalUpdates > 0}
                                                <Badge variant="secondary" class="gap-1">
                                                    <ArrowUpCircle class="h-3 w-3"/>
                                                    {site.totalUpdates} update{site.totalUpdates !== 1 ? 's' : ''}
                                                </Badge>
                                            {/if}
                                        </div>
                                    </div>
                                </div>

                                <!-- Thumbnail -->
                                <div class="aspect-[16/9] border bg-muted relative overflow-hidden">
                                    {#if site.thumbnailPath}
                                        <img
                                                src="/api/uploads/{site.thumbnailPath}"
                                                alt="{site.name} screenshot"
                                                class="w-full h-full object-cover object-top"
                                                loading="lazy"
                                        />
                                    {:else}
                                        <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
                                            <div class="text-center">
                                                <span class="text-3xl font-bold text-muted-foreground/40">{site.domain.charAt(0).toUpperCase()}</span>
                                                <p class="text-xs text-muted-foreground/40 mt-1">{site.domain}</p>
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            </div>

						</Card.Header>
						<Card.Content class="pt-0 space-y-3">
							<div class="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
								{#if site.wpVersion}
									<div>WP: <span class="text-foreground font-medium">{site.wpVersion}</span></div>
								{/if}
								{#if site.phpVersion}
									<div>PHP: <span class="text-foreground font-medium">{site.phpVersion}</span></div>
								{/if}
								{#if site.activePlugins > 0}
									<div>Plugins: <span class="text-foreground font-medium">{site.activePlugins}</span></div>
								{/if}
								{#if site.client}
									<div class="truncate">Client: <span class="text-foreground font-medium">{site.client.name}</span></div>
								{/if}
							</div>

							{#if site.lastSyncError && site.status === 'offline'}
								<p class="text-xs text-destructive truncate" title={site.lastSyncError}>
									{site.lastSyncError}
								</p>
							{/if}

							<div class="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
								<span>
									{#if site.lastSyncAt}
										Synced {formatDate(site.lastSyncAt)}
									{:else}
										Never synced
									{/if}
								</span>
								<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7"
										onclick={() => syncSite(site.id)}
										disabled={isSyncing}
										title="Sync now"
									>
										<RefreshCw class="h-3.5 w-3.5 {isSyncing ? 'animate-spin' : ''}" />
									</Button>
									{#if data.canUpdate}
										<Button
											variant="ghost"
											size="icon"
											class="h-7 w-7"
											onclick={() => openEditModal(site)}
											title="Edit"
										>
											<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>
										</Button>
									{/if}
									{#if data.canDelete}
										<Button
											variant="ghost"
											size="icon"
											class="h-7 w-7"
											onclick={() => confirmDelete({ id: site.id, name: site.name })}
											title="Delete"
										>
											<Trash2 class="h-3.5 w-3.5" />
										</Button>
									{/if}
								</div>
							</div>
						</Card.Content>
					</div>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>

<HostingSiteFormModal
	bind:open={formModalOpen}
	site={editingSite}
	clients={data.clients}
	services={data.services}
	onsave={() => {
		formModalOpen = false;
		editingSite = null;
		invalidateAll();
	}}
/>

<DeleteConfirmDialog
	bind:open={deleteDialogOpen}
	title="Delete Hosting Site"
	name={siteToDelete?.name}
	{isDeleting}
	onconfirm={handleDelete}
/>

<AlertDialog.Root bind:open={bulkDeleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Hosting Sites</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to permanently delete {selectedIds.size} hosting site(s)? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<Button variant="destructive" onclick={handleBulkDelete} disabled={isBulkDeleting}>
				{isBulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} site(s)`}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
