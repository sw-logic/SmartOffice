<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar';
	import { cn } from '$lib/utils';

	type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

	interface AvatarUser {
		firstName?: string | null;
		lastName?: string | null;
		name?: string;
		image?: string | null;
		avatarPath?: string | null;
	}

	let {
		user,
		size = 'md',
		title,
		class: className
	}: {
		user: AvatarUser;
		size?: Size;
		title?: string;
		class?: string;
	} = $props();

	const sizeMap: Record<Size, { root: string; fallback: string }> = {
		xs: { root: 'h-5 w-5', fallback: 'text-[9px]' },
		sm: { root: 'h-6 w-6', fallback: 'text-[10px]' },
		md: { root: '', fallback: 'text-xs' },
		lg: { root: 'h-8 w-8', fallback: 'text-xs' },
		xl: { root: 'h-10 w-10', fallback: 'text-[10px]' },
		'2xl': { root: 'h-12 w-12', fallback: 'text-lg' }
	};

	let s = $derived(sizeMap[size]);

	let imagePath = $derived(user.image || user.avatarPath || null);

	let displayName = $derived(
		user.firstName && user.lastName
			? `${user.firstName} ${user.lastName}`
			: (user.name ?? '')
	);

	let initials = $derived.by(() => {
		if (user.firstName || user.lastName) {
			return `${(user.firstName ?? '').charAt(0)}${(user.lastName ?? '').charAt(0)}`.toUpperCase();
		}
		if (user.name) {
			return user.name
				.split(' ')
				.map((w) => w[0])
				.slice(0, 2)
				.join('')
				.toUpperCase();
		}
		return '?';
	});
</script>

<Avatar.Root class={cn(s.root, className)} {title}>
	{#if imagePath}
		<Avatar.Image src="/api/uploads/{imagePath}" alt={displayName} />
	{/if}
	<Avatar.Fallback class={s.fallback}>{initials}</Avatar.Fallback>
</Avatar.Root>
