<script lang="ts">
	import type { Editor } from '@tiptap/core';
	import { EdraEditor } from '$lib/components/edra/shadcn/index.js';

	let {
		value = '',
		class: className = '',
		onchange
	}: {
		value: string;
		class?: string;
		onchange?: (markdown: string) => void;
	} = $props();

	let editor = $state<Editor>();
	let container: HTMLElement;
	let lastSyncedValue: string | null = null;

	// Sync content when value changes or editor becomes available.
	// Guard with lastSyncedValue to prevent infinite loop:
	// setContent → onTransaction → editor reassign → $effect re-run
	$effect(() => {
		const current = value;
		if (!editor || editor.isDestroyed) return;
		if (current === lastSyncedValue) return;
		lastSyncedValue = current;
		editor.commands.setContent(current || '', { contentType: 'markdown' });
	});

	function handleUpdate() {
		if (!editor || !onchange) return;
		const md = editor.getMarkdown();
		if (md !== lastSyncedValue) {
			lastSyncedValue = md;
			onchange(md);
		}
	}

	// onReadOnlyChecked only toggles the DOM checkbox — it does NOT update
	// the ProseMirror document, so onUpdate never fires. We listen for
	// checkbox change events via event delegation, then sync the DOM state
	// back into the document so the markdown can be extracted and saved.
	function handleCheckboxChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.type !== 'checkbox' || !editor || editor.isDestroyed || !onchange) return;

		// Let Tiptap's onReadOnlyChecked handler finish first
		setTimeout(() => {
			if (!editor || editor.isDestroyed) return;

			const { state, view } = editor;
			const { tr } = state;
			let modified = false;

			state.doc.descendants((node, pos) => {
				if (node.type.name === 'taskItem') {
					const domNode = view.nodeDOM(pos) as HTMLElement | null;
					if (domNode) {
						const cb = domNode.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
						if (cb && cb.checked !== node.attrs.checked) {
							tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: cb.checked });
							modified = true;
						}
					}
				}
			});

			if (modified) {
				view.dispatch(tr);
				// dispatch triggers onUpdate → handleUpdate → onchange
			}
		}, 0);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="md-viewer {className}" bind:this={container} onchange={handleCheckboxChange}>
	<EdraEditor
		bind:editor
		editable={false}
		onUpdate={handleUpdate}
		class="overflow-auto"
	/>
</div>
