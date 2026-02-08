<script lang="ts">
	import { Input } from '$lib/components/ui/input';

	interface Props {
		value: number | null; // minutes
		onchange: (minutes: number | null) => void;
		placeholder?: string;
		class?: string;
		required?: boolean;
		id?: string;
		name?: string;
	}

	let {
		value,
		onchange,
		placeholder = '1w 2d 3h 30m',
		class: className = '',
		required = false,
		id,
		name
	}: Props = $props();

	// 1 week = 5 working days, 1 day = 8 hours
	const MINUTES_PER_HOUR = 60;
	const MINUTES_PER_DAY = 8 * MINUTES_PER_HOUR;   // 480
	const MINUTES_PER_WEEK = 5 * MINUTES_PER_DAY;    // 2400

	let textValue = $state('');
	let isFocused = $state(false);

	// Convert minutes to display string (e.g. 2520 → "1w 0d 2h 0m")
	function minutesToDisplay(minutes: number): string {
		if (minutes <= 0) return '0m';

		const weeks = Math.floor(minutes / MINUTES_PER_WEEK);
		minutes %= MINUTES_PER_WEEK;
		const days = Math.floor(minutes / MINUTES_PER_DAY);
		minutes %= MINUTES_PER_DAY;
		const hours = Math.floor(minutes / MINUTES_PER_HOUR);
		const mins = minutes % MINUTES_PER_HOUR;

		const parts: string[] = [];
		if (weeks > 0) parts.push(`${weeks}w`);
		if (days > 0) parts.push(`${days}d`);
		if (hours > 0) parts.push(`${hours}h`);
		if (mins > 0) parts.push(`${mins}m`);

		return parts.join(' ') || '0m';
	}

	// Parse duration string to minutes (e.g. "1w 2d 3h 30m" → 4110)
	// Also accepts a plain number as minutes
	function parseDuration(input: string): number | null {
		const trimmed = input.trim();
		if (!trimmed) return null;

		// Check for duration pattern (contains w, d, h, or m suffixes)
		const durationPattern = /(\d+)\s*(w|d|h|m)/gi;
		const matches = [...trimmed.matchAll(durationPattern)];

		if (matches.length > 0) {
			let total = 0;
			for (const match of matches) {
				const num = parseInt(match[1]);
				const unit = match[2].toLowerCase();
				switch (unit) {
					case 'w': total += num * MINUTES_PER_WEEK; break;
					case 'd': total += num * MINUTES_PER_DAY; break;
					case 'h': total += num * MINUTES_PER_HOUR; break;
					case 'm': total += num; break;
				}
			}
			return total > 0 ? total : null;
		}

		// Fallback: plain number treated as minutes
		const num = parseInt(trimmed);
		return !isNaN(num) && num > 0 ? num : null;
	}

	// Sync textValue when external value changes (and not focused)
	$effect(() => {
		if (!isFocused) {
			textValue = value !== null && value > 0 ? minutesToDisplay(value) : '';
		}
	});

	function handleInput(e: Event) {
		textValue = (e.target as HTMLInputElement).value;
	}

	function handleBlur() {
		isFocused = false;
		const parsed = parseDuration(textValue);
		onchange(parsed);
		// Reformat the display
		textValue = parsed !== null ? minutesToDisplay(parsed) : '';
	}

	function handleFocus() {
		isFocused = true;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			(e.target as HTMLInputElement).blur();
		}
	}
</script>

<Input
	type="text"
	{id}
	{name}
	{required}
	{placeholder}
	class={className}
	value={textValue}
	oninput={handleInput}
	onblur={handleBlur}
	onfocus={handleFocus}
	onkeydown={handleKeydown}
/>
