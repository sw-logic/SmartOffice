<script lang="ts">
	import { Carta, Markdown as CartaViewer } from 'carta-md';
	import DOMPurify from 'isomorphic-dompurify';
	import 'carta-md/default.css';

	let {
		value = '',
		class: className = ''
	}: {
		value: string;
		class?: string;
	} = $props();

	const carta = new Carta({ sanitizer: (html) => DOMPurify.sanitize(html) });
</script>

<div class="md-viewer {className}">
	{#key value}
		<CartaViewer {carta} {value} />
	{/key}
</div>

<style>
	.md-viewer :global(.carta-viewer) {
		font-size: 0.875rem;
		line-height: 1.6;
	}

	.md-viewer :global(.carta-viewer h1) {
		font-size: 1.5rem;
		font-weight: 700;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
	}

	.md-viewer :global(.carta-viewer h2) {
		font-size: 1.25rem;
		font-weight: 600;
		margin-top: 0.75rem;
		margin-bottom: 0.375rem;
	}

	.md-viewer :global(.carta-viewer h3) {
		font-size: 1.1rem;
		font-weight: 600;
		margin-top: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.md-viewer :global(.carta-viewer p) {
		margin-bottom: 0.5rem;
	}

	.md-viewer :global(.carta-viewer ul),
	.md-viewer :global(.carta-viewer ol) {
		padding-left: 1.5rem;
		margin-bottom: 0.5rem;
	}

	.md-viewer :global(.carta-viewer ul) {
		list-style: disc;
	}

	.md-viewer :global(.carta-viewer ol) {
		list-style: decimal;
	}

	.md-viewer :global(.carta-viewer code) {
		background: var(--muted);
		padding: 0.125rem 0.25rem;
		border-radius: calc(var(--radius) - 4px);
		font-size: 0.8125rem;
		font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono',
			monospace;
	}

	.md-viewer :global(.carta-viewer pre) {
		background: var(--muted);
		padding: 0.75rem;
		border-radius: calc(var(--radius) - 2px);
		overflow-x: auto;
		margin-bottom: 0.5rem;
	}

	.md-viewer :global(.carta-viewer pre code) {
		background: transparent;
		padding: 0;
	}

	.md-viewer :global(.carta-viewer blockquote) {
		border-left: 3px solid var(--border);
		padding-left: 0.75rem;
		color: var(--muted-foreground);
		margin-bottom: 0.5rem;
	}

	.md-viewer :global(.carta-viewer a) {
		color: var(--primary);
		text-decoration: underline;
	}

	.md-viewer :global(.carta-viewer hr) {
		border-color: var(--border);
		margin: 0.75rem 0;
	}

	.md-viewer :global(.carta-viewer table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 0.5rem;
	}

	.md-viewer :global(.carta-viewer th),
	.md-viewer :global(.carta-viewer td) {
		border: 1px solid var(--border);
		padding: 0.375rem 0.5rem;
		text-align: left;
	}

	.md-viewer :global(.carta-viewer th) {
		background: var(--muted);
		font-weight: 600;
	}

	.md-viewer :global(.carta-viewer strong) {
		font-weight: 700;
	}

	.md-viewer :global(.carta-viewer em) {
		font-style: italic;
	}
</style>
