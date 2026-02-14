<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { toast } from 'svelte-sonner';

	interface Props {
		open: boolean;
		site?: {
			id: number;
			name: string;
			domain: string;
			apiUrl: string;
			apiKey: string;
			serviceId?: number | null;
			clientId?: number | null;
		} | null;
		clients: Array<{ id: number; name: string }>;
		services: Array<{ id: number; name: string }>;
		onsave: () => void;
	}

	let { open = $bindable(), site = null, clients, services, onsave }: Props = $props();

	let name = $state('');
	let domain = $state('');
	let apiUrl = $state('');
	let apiKey = $state('');
	let clientId = $state<string>('');
	let serviceId = $state<string>('');
	let isSaving = $state(false);

	let isEdit = $derived(!!site);

	// Populate form when site changes
	$effect(() => {
		if (open) {
			if (site) {
				name = site.name;
				domain = site.domain;
				apiUrl = site.apiUrl;
				apiKey = site.apiKey;
				clientId = site.clientId ? String(site.clientId) : '';
				serviceId = site.serviceId ? String(site.serviceId) : '';
			} else {
				name = '';
				domain = '';
				apiUrl = '';
				apiKey = '';
				clientId = '';
				serviceId = '';
			}
		}
	});

	// Auto-fill API URL from domain
	function onDomainInput() {
		if (!isEdit && domain && !apiUrl) {
			const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
			apiUrl = `https://${cleanDomain}/wp-json/smartoffice/v1`;
		}
	}

	async function handleSubmit() {
		if (!name.trim() || !domain.trim() || !apiUrl.trim() || !apiKey.trim()) {
			toast.error('Name, domain, API URL and API key are required');
			return;
		}

		isSaving = true;

		const payload = {
			name: name.trim(),
			domain: domain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, ''),
			apiUrl: apiUrl.trim(),
			apiKey: apiKey.trim(),
			clientId: clientId ? parseInt(clientId) : null,
			serviceId: serviceId ? parseInt(serviceId) : null
		};

		try {
			const url = isEdit ? `/api/hosting/${site!.id}` : '/api/hosting';
			const method = isEdit ? 'PUT' : 'POST';

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (res.ok) {
				toast.success(isEdit ? 'Site updated' : 'Site added');
				onsave();
			} else {
				const err = await res.json().catch(() => ({}));
				toast.error(err.message || `Failed to ${isEdit ? 'update' : 'create'} site`);
			}
		} catch {
			toast.error('An error occurred');
		} finally {
			isSaving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{isEdit ? 'Edit' : 'Add'} Hosting Site</Dialog.Title>
			<Dialog.Description>
				{isEdit ? 'Update the connection details.' : 'Connect a WordPress site with the SmartOffice Connector plugin.'}
			</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
			<div class="space-y-2">
				<Label for="hs-name">Name *</Label>
				<Input id="hs-name" bind:value={name} placeholder="Client X Website" required />
			</div>

			<div class="space-y-2">
				<Label for="hs-domain">Domain *</Label>
				<Input
					id="hs-domain"
					bind:value={domain}
					placeholder="clientx.com"
					oninput={onDomainInput}
					required
				/>
			</div>

			<div class="space-y-2">
				<Label for="hs-api-url">API URL *</Label>
				<Input
					id="hs-api-url"
					bind:value={apiUrl}
					placeholder="https://clientx.com/wp-json/smartoffice/v1"
					required
				/>
				<p class="text-xs text-muted-foreground">
					Found in WordPress &gt; Settings &gt; SmartOffice &gt; Connection Info
				</p>
			</div>

			<div class="space-y-2">
				<Label for="hs-api-key">API Key *</Label>
				<Input
					id="hs-api-key"
					bind:value={apiKey}
					placeholder="Paste the API key from the WordPress plugin"
					type="password"
					required
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label>Client</Label>
					<Select.Root type="single" value={clientId} onValueChange={(v) => (clientId = v ?? '')}>
						<Select.Trigger>
							{clients.find((c) => String(c.id) === clientId)?.name || 'Select client...'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="">None</Select.Item>
							{#each clients as client}
								<Select.Item value={String(client.id)}>{client.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div class="space-y-2">
					<Label>Linked Service</Label>
					<Select.Root type="single" value={serviceId} onValueChange={(v) => (serviceId = v ?? '')}>
						<Select.Trigger>
							{services.find((s) => String(s.id) === serviceId)?.name || 'Select service...'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="">None</Select.Item>
							{#each services as service}
								<Select.Item value={String(service.id)}>{service.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<Dialog.Footer>
				<Button variant="outline" type="button" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={isSaving}>
					{isSaving ? 'Saving...' : isEdit ? 'Update' : 'Add Site'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
