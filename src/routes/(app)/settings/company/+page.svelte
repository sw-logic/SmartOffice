<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Building2, Construction } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Company Settings - SmartOffice</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<Building2 class="h-7 w-7 text-muted-foreground" />
		<div>
			<h1 class="text-2xl font-bold">Company</h1>
			<p class="text-muted-foreground text-sm">Manage company profile and settings</p>
		</div>
	</div>

	<Card.Root>
		<Card.Content class="flex flex-col items-center justify-center py-16 text-center">
			<Construction class="h-12 w-12 text-muted-foreground mb-4" />
			<h2 class="text-lg font-semibold mb-2">Coming Soon</h2>
			<p class="text-muted-foreground max-w-md">
				The Company Settings module is under development. It will allow you to manage your company profile, logo, contact details, fiscal year, and default currency.
			</p>
		</Card.Content>
	</Card.Root>
</div>
