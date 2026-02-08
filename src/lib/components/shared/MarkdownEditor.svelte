<script lang="ts">
	import { Carta, MarkdownEditor as CartaEditor } from 'carta-md';
	import DOMPurify from 'isomorphic-dompurify';
	import 'carta-md/default.css';

	let {
		value = $bindable(''),
		placeholder = '',
		mode = 'tabs',
		disableToolbar = false,
		class: className = ''
	}: {
		value: string;
		placeholder?: string;
		mode?: 'tabs' | 'split' | 'auto';
		disableToolbar?: boolean;
		class?: string;
	} = $props();

	const carta = new Carta({ sanitizer: (html) => DOMPurify.sanitize(html) });
</script>

<CartaEditor theme="smart" {carta} bind:value {placeholder} {mode} {disableToolbar} />
