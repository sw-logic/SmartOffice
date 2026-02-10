<script lang="ts">
	import type { Editor } from '@tiptap/core';
	import { EdraEditor, EdraToolBar } from '$lib/components/edra/shadcn/index.js';

	let {
		value = $bindable(''),
		placeholder = '',
		class: className = ''
	}: {
		value: string;
		placeholder?: string;
		class?: string;
	} = $props();

	let editor = $state<Editor>();
	let lastSyncedValue: string | null = null;

	function handleUpdate() {
		if (!editor) return;
		const md = editor.getMarkdown();
		lastSyncedValue = md;
		value = md;
	}

	// Sync content when value changes externally or editor becomes available.
	// Guard with lastSyncedValue to prevent infinite loop:
	// setContent → onTransaction → editor reassign → $effect re-run
	$effect(() => {
		const current = value;
		if (!editor || editor.isDestroyed) return;
		if (current === lastSyncedValue) return;
		lastSyncedValue = current;
		editor.commands.setContent(current || '', { contentType: 'markdown' });
	});
</script>

<div class="markdown-editor-wrapper {className}">
	{#if editor}
		<div class="rounded-t border-x border-t p-1">
			<EdraToolBar
				{editor}
				excludedCommands={['media', 'math']}
			/>
		</div>
	{/if}

	<div class="rounded-b border resize-y overflow-auto min-h-[200px]">
		<EdraEditor
			bind:editor
			onUpdate={handleUpdate}
			class="h-full overflow-auto p-3"
		/>
	</div>
</div>
