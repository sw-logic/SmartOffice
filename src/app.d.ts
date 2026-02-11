// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session } from '@auth/sveltekit';

declare global {
	// Web Speech API types (not included in default TypeScript lib)
	interface SpeechRecognition extends EventTarget {
		lang: string;
		continuous: boolean;
		interimResults: boolean;
		onresult: ((event: SpeechRecognitionEvent) => void) | null;
		onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
		onend: (() => void) | null;
		start(): void;
		stop(): void;
		abort(): void;
	}

	interface SpeechRecognitionEvent extends Event {
		readonly resultIndex: number;
		readonly results: SpeechRecognitionResultList;
	}

	interface SpeechRecognitionResultList {
		readonly length: number;
		[index: number]: SpeechRecognitionResult;
	}

	interface SpeechRecognitionResult {
		readonly isFinal: boolean;
		readonly length: number;
		[index: number]: SpeechRecognitionAlternative;
	}

	interface SpeechRecognitionAlternative {
		readonly transcript: string;
		readonly confidence: number;
	}

	interface SpeechRecognitionErrorEvent extends Event {
		readonly error: string;
		readonly message: string;
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	interface SpeechRecognitionConstructor {
		new (): SpeechRecognition;
	}

	interface Window {
		SpeechRecognition?: SpeechRecognitionConstructor;
		webkitSpeechRecognition?: SpeechRecognitionConstructor;
	}

	namespace App {
		interface Locals {
			user?: {
				id: number;
				email: string;
				name: string;
				image?: string | null;
				companyId?: number;
			};
			permissions?: Set<string>;
			auth(): Promise<Session | null>;
		}
		interface PageData {
			session?: Session | null;
		}
		// interface Error {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
