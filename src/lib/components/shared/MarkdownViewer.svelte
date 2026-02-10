<script lang="ts">
	import { Editor } from '@tiptap/core';
	import Highlight from '@tiptap/extension-highlight';
	import { TaskItem, TaskList } from '@tiptap/extension-list';
	import Subscript from '@tiptap/extension-subscript';
	import Superscript from '@tiptap/extension-superscript';
	import TextAlign from '@tiptap/extension-text-align';
	import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
	import Typography from '@tiptap/extension-typography';
	import StarterKit from '@tiptap/starter-kit';
	import { Table, TableCell, TableHeader, TableRow } from '$lib/components/edra/extensions/table/index.js';
	import { Markdown } from '@tiptap/markdown';
	import { onDestroy, onMount } from 'svelte';
	import '$lib/components/edra/editor.css';
	import '$lib/components/edra/shadcn/style.css';

	let {
		value = '',
		class: className = '',
		onchange
	}: {
		value: string;
		class?: string;
		onchange?: (markdown: string) => void;
	} = $props();

	let editor: Editor | undefined = $state();
	let element: HTMLElement;
	let lastSyncedValue: string | null = null;

	onMount(() => {
		editor = new Editor({
			element,
			editable: false,
			extensions: [
				StarterKit.configure({
					orderedList: { HTMLAttributes: { class: 'list-decimal' } },
					bulletList: { HTMLAttributes: { class: 'list-disc' } },
					heading: { levels: [1, 2, 3, 4] },
					link: {
						openOnClick: false,
						autolink: false,
						HTMLAttributes: {
							target: '_blank',
							rel: 'noopener noreferrer nofollow'
						}
					}
				}),
				Highlight.configure({ multicolor: true }),
				Color,
				TextStyle,
				FontSize,
				Subscript,
				Superscript,
				Typography,
				TextAlign.configure({ types: ['heading', 'paragraph'] }),
				TaskList,
				TaskItem.configure({
					nested: true,
					onReadOnlyChecked: () => true
				}),
				Table,
				TableHeader,
				TableRow,
				TableCell,
				Markdown
			],
			...(onchange
				? {
						onUpdate: () => {
							if (!editor || !onchange) return;
							const md = editor.getMarkdown();
							if (md !== lastSyncedValue) {
								lastSyncedValue = md;
								onchange(md);
							}
						}
					}
				: {})
		});
	});

	onDestroy(() => {
		if (editor) editor.destroy();
	});

	// Sync content when value changes or editor becomes available.
	// Guard with lastSyncedValue to prevent infinite loop:
	// setContent → onTransaction → $effect re-run
	$effect(() => {
		const current = value;
		if (!editor || editor.isDestroyed) return;
		if (current === lastSyncedValue) return;
		lastSyncedValue = current;
		editor.commands.setContent(current || '', { contentType: 'markdown' });
	});

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
				// dispatch triggers onUpdate → onchange
			}
		}, 0);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="md-viewer {className}" onchange={handleCheckboxChange}>
	<div bind:this={element} class="edra-editor overflow-auto *:outline-none"></div>
</div>
