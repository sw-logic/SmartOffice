<script lang="ts">
	import { X } from 'lucide-svelte';

	let {
		value = $bindable(''),
		size = 'default',
		clearable = true
	}: {
		value: string;
		size?: 'default' | 'sm';
		clearable?: boolean;
	} = $props();

	let hexInput = $state(value);

	$effect(() => {
		hexInput = value;
	});

	function handleHexInput(e: Event) {
		let raw = (e.target as HTMLInputElement).value.trim();
		// Auto-prepend # if user typed a bare hex
		if (raw && !raw.startsWith('#')) {
			raw = '#' + raw;
		}
		hexInput = raw;
		// Only commit valid 3/6-digit hex
		if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) {
			value = raw;
		}
	}

	function handleHexBlur() {
		// On blur, sync back to canonical value (or clear if invalid)
		if (!hexInput || hexInput === '#') {
			value = '';
			hexInput = '';
		} else if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hexInput)) {
			value = hexInput;
		} else {
			// Revert to last valid value
			hexInput = value;
		}
	}

	function handlePickerInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		value = v;
		hexInput = v;
	}

	function clear() {
		value = '';
		hexInput = '';
	}

	let h = $derived(size === 'sm' ? 'h-7' : 'h-8');
	let pickerSize = $derived(size === 'sm' ? 'h-7 w-7' : 'h-8 w-8');
</script>

<div class="flex items-center gap-1.5">
	<input
		type="color"
		value={value || '#000000'}
		oninput={handlePickerInput}
		class="{pickerSize} rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
	/>
	<input
		type="text"
		value={hexInput}
		oninput={handleHexInput}
		onblur={handleHexBlur}
		placeholder="#hex"
		maxlength="7"
		class="{h} w-[5.5rem] rounded-md border border-input bg-background px-2 text-xs font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
	/>
	{#if clearable && value}
		<button
			type="button"
			class="text-muted-foreground hover:text-foreground shrink-0"
			onclick={clear}
			title="Remove color"
		>
			<X class="h-3 w-3" />
		</button>
	{/if}
</div>
