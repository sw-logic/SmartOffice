// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session } from '@auth/sveltekit';

declare global {
	namespace App {
		interface Locals {
			user?: {
				id: number;
				email: string;
				name: string;
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
