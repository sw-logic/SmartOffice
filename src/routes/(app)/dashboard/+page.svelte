<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Users, Briefcase, DollarSign, FileText } from 'lucide-svelte';

	let { data } = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
		<p class="text-muted-foreground">Welcome back, {data.user?.name ?? 'User'}!</p>
	</div>

	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Clients</Card.Title>
				<Users class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">0</div>
				<p class="text-xs text-muted-foreground">Active clients</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Active Projects</Card.Title>
				<Briefcase class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">0</div>
				<p class="text-xs text-muted-foreground">In progress</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Income</Card.Title>
				<DollarSign class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">$0.00</div>
				<p class="text-xs text-muted-foreground">This month</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Pending Offers</Card.Title>
				<FileText class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">0</div>
				<p class="text-xs text-muted-foreground">Awaiting response</p>
			</Card.Content>
		</Card.Root>
	</div>

	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Recent Activity</Card.Title>
				<Card.Description>Your latest actions in the system</Card.Description>
			</Card.Header>
			<Card.Content>
				<p class="text-sm text-muted-foreground">No recent activity</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Quick Actions</Card.Title>
				<Card.Description>Common tasks you can perform</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-2">
				<p class="text-sm text-muted-foreground">
					Create clients, projects, and more from the sidebar navigation.
				</p>
			</Card.Content>
		</Card.Root>
	</div>
</div>
