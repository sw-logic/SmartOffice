<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { CreditCard, Construction } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Payments - SmartOffice</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<CreditCard class="h-7 w-7 text-muted-foreground" />
		<div>
			<h1 class="text-2xl font-bold">Payments</h1>
			<p class="text-muted-foreground text-sm">Track and manage payment transactions</p>
		</div>
	</div>

	<Card.Root>
		<Card.Content class="flex flex-col items-center justify-center py-16 text-center">
			<Construction class="h-12 w-12 text-muted-foreground mb-4" />
			<h2 class="text-lg font-semibold mb-2">Coming Soon</h2>
			<p class="text-muted-foreground max-w-md">
				The Payments module is under development. It will allow you to track payment transactions, reconcile invoices, and manage payment statuses.
			</p>
		</Card.Content>
	</Card.Root>
</div>
