<script lang="ts">
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import { TaskItem, TaskList } from '@tiptap/extension-list';
	import Typography from '@tiptap/extension-typography';
	import { Placeholder } from '@tiptap/extensions';
	import { Markdown } from '@tiptap/markdown';
	import { Table, TableCell, TableHeader, TableRow } from '$lib/components/edra/extensions/table/index.js';
	import AutoJoiner from 'tiptap-extension-auto-joiner';

	import { EdraToolBar } from '$lib/components/edra/shadcn/index.js';
	import LinkMenu from '$lib/components/edra/shadcn/menus/Link.svelte';
	import TableColMenu from '$lib/components/edra/shadcn/menus/TableCol.svelte';
	import TableRowMenu from '$lib/components/edra/shadcn/menus/TableRow.svelte';

	import '$lib/components/edra/editor.css';
	import '$lib/components/edra/shadcn/style.css';
	import strings from '$lib/components/edra/strings.js';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Mic, Square } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';

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
	let element: HTMLElement;
	let lastSyncedValue: string | null = null;

	// Speech recognition state
	let isRecording = $state(false);
	let speechSupported = $state(false);
	let recognition: SpeechRecognition | null = null;
	let SpeechRecognitionCtor: SpeechRecognitionConstructor | undefined;

	// Track interim (not-yet-final) text position so we can replace it
	let interimRange: { from: number; to: number } | null = null;

	// Spoken punctuation words → symbols (Hungarian)
	const punctuationRules: [RegExp, string][] = [
		[/\búj bekezdés\b/gi, '\n\n'],
		[/\búj sor\b/gi, '\n'],
		[/\bpont\b/gi, '.'],
		[/\bvessző\b/gi, ','],
		[/\bkérdőjel\b/gi, '?'],
		[/\bfelkiáltójel\b/gi, '!'],
		[/\bkettőspont\b/gi, ':'],
		[/\bpontosvessző\b/gi, ';'],
		[/\bgondolatjel\b/gi, ' –'],
		[/\bidézőjel\b/gi, '"'],
		[/\bzárójel nyit\b/gi, '('],
		[/\bzárójel zár\b/gi, ')']
	];

	function processTranscript(text: string): string {
		let result = text;
		for (const [pattern, replacement] of punctuationRules) {
			result = result.replace(pattern, replacement);
		}
		result = result.replace(/\s+([.,!?;:)])/g, '$1');
		result = result.replace(/([.,!?;:])(?=[^\s\n)"]|$)/g, '$1 ');
		result = result.replace(/([.!?][\s]+)([\p{Ll}])/gu, (_, punct, letter) => {
			return punct + letter.toUpperCase();
		});
		if (result.length > 0 && shouldCapitalizeFirst()) {
			result = result.replace(/^(\s*)([\p{Ll}])/u, (_, space, letter) => {
				return space + letter.toUpperCase();
			});
		}
		return result;
	}

	function shouldCapitalizeFirst(): boolean {
		if (!editor) return true;
		const { from } = editor.state.selection;
		if (from <= 1) return true;
		const start = Math.max(1, from - 3);
		const textBefore = editor.state.doc.textBetween(start, from);
		return /[.!?]\s*$/.test(textBefore) || textBefore.trim() === '';
	}

	function createRecognition(): SpeechRecognition {
		const rec = new SpeechRecognitionCtor!();
		rec.lang = 'hu-HU';
		rec.continuous = true;
		rec.interimResults = true;

		rec.onresult = (event: SpeechRecognitionEvent) => {
			if (!editor) return;
			if (interimRange) {
				const docSize = editor.state.doc.content.size;
				if (interimRange.from <= docSize && interimRange.to <= docSize) {
					editor.chain().deleteRange(interimRange).run();
				}
				interimRange = null;
			}
			let finalText = '';
			let interimText = '';
			for (let i = event.resultIndex; i < event.results.length; i++) {
				if (event.results[i].isFinal) {
					finalText += event.results[i][0].transcript;
				} else {
					interimText += event.results[i][0].transcript;
				}
			}
			if (finalText) {
				editor.chain().focus().insertContent(processTranscript(finalText)).run();
			}
			if (interimText) {
				const from = editor.state.selection.from;
				editor.chain().focus().insertContent(processTranscript(interimText)).run();
				const to = editor.state.selection.from;
				interimRange = { from, to };
			}
		};

		rec.onerror = (event: SpeechRecognitionErrorEvent) => {
			console.error('Speech recognition error:', event.error);
			if (event.error === 'not-allowed') {
				toast.error('Microphone access denied. Please allow microphone permission in your browser settings.');
			} else if (event.error === 'no-speech') {
				return;
			} else {
				toast.error(`Speech recognition error: ${event.error}`);
			}
			isRecording = false;
			recognition = null;
		};

		rec.onend = () => {
			if (isRecording) {
				try { rec.start(); } catch { isRecording = false; recognition = null; }
			} else {
				recognition = null;
			}
		};

		return rec;
	}

	function toggleRecording() {
		if (!SpeechRecognitionCtor) return;
		if (isRecording) {
			isRecording = false;
			interimRange = null;
			recognition?.stop();
			toast.info('Dictation stopped.');
		} else {
			try {
				const rec = createRecognition();
				rec.start();
				recognition = rec;
				isRecording = true;
				toast.success('Dictation started. Speak now...');
			} catch (e) {
				isRecording = false;
				recognition = null;
				toast.error('Could not start dictation. ' + (e instanceof Error ? e.message : ''));
			}
		}
	}

	onMount(() => {
		SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (SpeechRecognitionCtor) {
			speechSupported = true;
		}

		editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					orderedList: { HTMLAttributes: { class: 'list-decimal' } },
					bulletList: { HTMLAttributes: { class: 'list-disc' } },
					heading: { levels: [1, 2, 3, 4] },
					link: {
						openOnClick: false,
						autolink: true,
						linkOnPaste: true,
						HTMLAttributes: {
							target: '_blank',
							rel: 'noopener noreferrer nofollow'
						}
					}
				}),
				Placeholder.configure({
					emptyEditorClass: 'is-empty',
					placeholder: ({ node }) => {
						if (node.type.name === 'heading') return strings.editor.headingPlaceholder;
						if (node.type.name === 'paragraph') return placeholder || strings.editor.paragraphPlaceholder;
						return '';
					}
				}),
				Typography,
				TaskList,
				TaskItem.configure({ nested: true, onReadOnlyChecked: () => true }),
				Table,
				TableHeader,
				TableRow,
				TableCell,
				AutoJoiner,
				Markdown
			],
			onUpdate: ({ editor: e }) => {
				const md = e.getMarkdown();
				lastSyncedValue = md;
				value = md;
			},
			onTransaction({ editor: e }) {
				editor = undefined;
				editor = e;
			},
			onContentError: (error) => {
				toast.error('Unable to load the content');
				console.error(error);
			}
		});
	});

	onDestroy(() => {
		if (recognition && isRecording) {
			isRecording = false;
			recognition.stop();
		}
		if (editor) editor.destroy();
	});

	// Auto-focus the editable area when editor becomes available
	let hasFocused = false;
	$effect(() => {
		if (!editor || editor.isDestroyed || hasFocused) return;
		hasFocused = true;
		requestAnimationFrame(() => {
			editor?.commands.focus('end');
		});
	});

	// Sync content when value changes externally or editor becomes available.
	$effect(() => {
		const current = value;
		if (!editor || editor.isDestroyed) return;
		if (current === lastSyncedValue) return;
		lastSyncedValue = current;
		editor.commands.setContent(current || '', { contentType: 'markdown' });
	});

	/** Toolbar commands to exclude — non-markdown features */
	const excludedCommands = [
		'media', 'math', 'alignment', 'fontSize', 'colors',
		'underline', 'superscript', 'subscript'
	];
</script>

<div class="markdown-editor-wrapper {className}">
	{#if editor}
		<LinkMenu {editor} parentElement={element} />
		<TableColMenu {editor} parentElement={element} />
		<TableRowMenu {editor} parentElement={element} />

		<div class="rounded-t border-x border-t p-1 flex flex-wrap items-center gap-1">
			<EdraToolBar
				{editor}
				class="compact-toolbar"
				{excludedCommands}
			/>
			{#if speechSupported}
				<div class="ml-auto flex items-center gap-1 pl-2 border-l">
					<Button
						variant={isRecording ? 'destructive' : 'ghost'}
						size="icon-sm"
						onclick={toggleRecording}
						title={isRecording ? 'Stop dictation' : 'Start dictation (Hungarian)'}
					>
						{#if isRecording}
							<Square class="size-4" />
						{:else}
							<Mic class="size-4" />
						{/if}
					</Button>
					{#if isRecording}
						<span class="text-xs text-destructive animate-pulse">REC</span>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<div class="rounded-b border resize-y overflow-auto min-h-[200px]">
		<div
			bind:this={element}
			id="edra-editor"
			class="edra-editor h-full w-full cursor-auto *:outline-none overflow-auto p-3"
		></div>
	</div>
</div>

<style>
	/* Make toolbar buttons compact (28px instead of 36px) */
	:global(.compact-toolbar [data-slot="button"]) {
		width: 1.75rem;
		height: 1.75rem;
		min-width: 1.75rem;
		min-height: 1.75rem;
	}
	:global(.compact-toolbar) {
		flex-wrap: wrap;
		gap: 1px;
		padding: 2px;
	}
</style>
