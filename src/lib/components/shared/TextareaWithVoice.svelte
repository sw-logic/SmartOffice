<script lang="ts">
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Mic, Square } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';

	let {
		value = $bindable(''),
		label = '',
		id = '',
		placeholder = '',
		maxlength = 160,
		rows = 3,
		class: className = ''
	}: {
		value: string;
		label?: string;
		id?: string;
		placeholder?: string;
		maxlength?: number;
		rows?: number;
		class?: string;
	} = $props();

	let charCount = $derived(value.length);
	let isOverLimit = $derived(charCount > maxlength);

	// Speech recognition
	let isRecording = $state(false);
	let speechSupported = $state(false);
	let recognition: SpeechRecognition | null = null;
	let SpeechRecognitionCtor: SpeechRecognitionConstructor | undefined;
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	onMount(() => {
		SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (SpeechRecognitionCtor) {
			speechSupported = true;
		}
	});

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

		// Fix spacing: remove space before punctuation, ensure space after
		result = result.replace(/\s+([.,!?;:)])/g, '$1');
		result = result.replace(/([.,!?;:])(?=[^\s\n)"]|$)/g, '$1 ');

		// Capitalize after sentence-ending punctuation
		result = result.replace(/([.!?][\s]+)([\p{Ll}])/gu, (_, punct, letter) => {
			return punct + letter.toUpperCase();
		});

		// Capitalize first letter if at start of text or after sentence-ender
		if (result.length > 0) {
			const textBefore = value.slice(0, textareaRef?.selectionStart ?? value.length);
			const shouldCap = textBefore.length === 0 || /[.!?]\s*$/.test(textBefore) || textBefore.trim() === '';
			if (shouldCap) {
				result = result.replace(/^(\s*)([\p{Ll}])/u, (_, space, letter) => {
					return space + letter.toUpperCase();
				});
			}
		}

		return result;
	}

	function createRecognition(): SpeechRecognition {
		const rec = new SpeechRecognitionCtor!();
		rec.lang = 'hu-HU';
		rec.continuous = true;
		rec.interimResults = true;

		let interimStart: number | null = null;
		let interimLength = 0;

		rec.onresult = (event: SpeechRecognitionEvent) => {
			// Remove previous interim text
			if (interimLength > 0 && interimStart !== null) {
				value = value.slice(0, interimStart) + value.slice(interimStart + interimLength);
				interimLength = 0;
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

			const insertPos = interimStart ?? (textareaRef?.selectionStart ?? value.length);

			if (finalText) {
				const processed = processTranscript(finalText);
				value = value.slice(0, insertPos) + processed + value.slice(insertPos);
				interimStart = null;
				interimLength = 0;
			}

			if (interimText) {
				const processed = processTranscript(interimText);
				const pos = interimStart ?? (finalText ? insertPos + processTranscript(finalText).length : insertPos);
				interimStart = pos;
				interimLength = processed.length;
				value = value.slice(0, pos) + processed + value.slice(pos);
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
				try {
					rec.start();
				} catch {
					isRecording = false;
					recognition = null;
				}
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

	onDestroy(() => {
		if (recognition && isRecording) {
			isRecording = false;
			recognition.stop();
		}
	});
</script>

<div class="space-y-2 {className}">
	{#if label}
		<div class="flex items-center gap-2">
			<Label for={id} class="mr-auto">{label}</Label>
			{#if speechSupported}
				<Button
					type="button"
					variant={isRecording ? 'destructive' : 'ghost'}
					size="icon-sm"
					onclick={toggleRecording}
					title={isRecording ? 'Stop dictation' : 'Start dictation (Hungarian)'}
					class="size-6"
				>
					{#if isRecording}
						<Square class="size-3" />
					{:else}
						<Mic class="size-3" />
					{/if}
				</Button>
				{#if isRecording}
					<span class="text-xs text-destructive animate-pulse">REC</span>
				{/if}
			{/if}
		</div>
	{/if}
	<Textarea
		{id}
		{placeholder}
		{rows}
		bind:value
		bind:ref={textareaRef}
		maxlength={maxlength}
	/>
	<div class="flex justify-end">
		<span class="text-xs {isOverLimit ? 'text-destructive' : 'text-muted-foreground'}">
			{charCount}/{maxlength}
		</span>
	</div>
</div>
