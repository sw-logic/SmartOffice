<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import OfferEditor from '$lib/components/shared/OfferEditor.svelte';

	let { data } = $props();

	// Pre-fill clientId if passed via query param
	let initialOffer = data.preselectedClientId
		? {
				id: 0,
				offerNumber: '',
				title: null,
				showGrandTotal: true,
				date: new Date().toISOString(),
				validUntil: '',
				clientId: data.preselectedClientId,
				status: 'draft',
				currency: 'USD',
				discountType: null,
				discountValue: null,
				notes: null,
				terms: null,
				options: [{ id: 0, name: 'Option 1', description: null, items: [] }]
			}
		: null;

	async function handleSave(payload: any) {
		const response = await fetch('/api/offers', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			const data = await response.json();
			throw new Error(data.error || 'Failed to create offer');
		}

		const result = await response.json();
		toast.success('Offer created successfully');
		goto(`/offers/${result.offer.id}`);
	}

	function handleCancel() {
		goto('/offers');
	}
</script>

<div class="space-y-4">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" onclick={() => goto('/offers')}>
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<h1 class="text-3xl font-bold tracking-tight">New Offer</h1>
	</div>

	<OfferEditor
		offer={initialOffer}
		clients={data.clients}
		priceListItems={data.priceListItems}
		enums={data.enums}
		onSave={handleSave}
		onCancel={handleCancel}
	/>
</div>
