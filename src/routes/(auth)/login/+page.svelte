<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { toast } from 'svelte-sonner';

	let email = $state('');
	let password = $state('');
	let isLoading = $state(false);
	let error = $state('');

	const callbackUrl = $derived($page.url.searchParams.get('callbackUrl') || '/dashboard');
	const urlError = $derived($page.url.searchParams.get('error'));

	// Show error from URL if present
	$effect(() => {
		if (urlError) {
			error = 'Invalid credentials. Please try again.';
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		if (!email || !password) {
			error = 'Please enter email and password';
			return;
		}

		isLoading = true;

		try {
			const result = await signIn('credentials', {
				email,
				password,
				redirectTo: callbackUrl
			});

			// If we get here without redirect, there was an error
			if (result?.error) {
				error = 'Invalid email or password';
			}
		} catch (err) {
			error = 'An error occurred. Please try again.';
			console.error('Login error:', err);
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-1">
			<Card.Title class="text-2xl font-bold">Sign In</Card.Title>
			<Card.Description>Enter your credentials to access your account</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if error}
				<div class="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-4">
				<div class="space-y-2">
					<Label for="email">Email</Label>
					<Input
						id="email"
						type="email"
						placeholder="admin@example.com"
						bind:value={email}
						disabled={isLoading}
						required
					/>
				</div>

				<div class="space-y-2">
					<Label for="password">Password</Label>
					<Input
						id="password"
						type="password"
						placeholder="Enter your password"
						bind:value={password}
						disabled={isLoading}
						required
					/>
				</div>

				<Button type="submit" class="w-full" disabled={isLoading}>
					{isLoading ? 'Signing in...' : 'Sign In'}
				</Button>
			</form>

			<div class="mt-4 text-center text-sm text-muted-foreground">
				<p>Default credentials:</p>
				<p class="font-mono">admin@example.com / admin123</p>
			</div>
		</Card.Content>
	</Card.Root>
</div>
