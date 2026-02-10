<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import OfferEditor from '$lib/components/shared/OfferEditor.svelte';

	let { data } = $props();

	async function handleSave(payload: any) {
		const response = await fetch(`/api/offers/${data.offer.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			const result = await response.json();
			throw new Error(result.error || 'Failed to update offer');
		}

		toast.success('Offer updated successfully');
		goto(`/offers/${data.offer.id}`);
	}

	function handleCancel() {
		goto(`/offers/${data.offer.id}`);
	}
</script>

<div class="space-y-4">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" onclick={() => goto(`/offers/${data.offer.id}`)}>
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<h1 class="text-3xl font-bold tracking-tight">Edit {data.offer.offerNumber}</h1>
	</div>

	<OfferEditor
		offer={data.offer}
		clients={data.clients}
		priceListItems={data.priceListItems}
		enums={data.enums}
		onSave={handleSave}
		onCancel={handleCancel}
	/>
</div>
