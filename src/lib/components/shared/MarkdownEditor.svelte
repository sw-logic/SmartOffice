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
	let internalUpdate = false;
	let initialized = false;

	function handleUpdate() {
		if (!editor) return;
		if (internalUpdate) {
			internalUpdate = false;
			return;
		}
		value = editor.getMarkdown();
	}

	// Set initial markdown content once editor is ready, then sync external changes
	$effect(() => {
		const current = value;
		if (!editor || editor.isDestroyed) return;

		if (!initialized) {
			initialized = true;
			if (current) {
				internalUpdate = true;
				editor.commands.setContent(current, { contentType: 'markdown' });
			}
			return;
		}

		const editorMarkdown = editor.getMarkdown();
		if (current !== editorMarkdown) {
			internalUpdate = true;
			editor.commands.setContent(current, { contentType: 'markdown' });
		}
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
