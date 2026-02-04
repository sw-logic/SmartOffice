import { writable, derived } from 'svelte/store';

export interface UserState {
	id: string;
	email: string;
	name: string;
	image?: string | null;
	companyId?: string;
	permissions: Array<{ module: string; action: string }>;
}

// Create the user store
function createUserStore() {
	const { subscribe, set, update } = writable<UserState | null>(null);

	return {
		subscribe,
		set,
		update,
		logout: () => set(null),
		hasPermission: (user: UserState | null, module: string, action: string): boolean => {
			if (!user) return false;
			return user.permissions.some(
				p =>
					(p.module === module && p.action === action) ||
					(p.module === '*' && p.action === '*') ||
					(p.module === module && p.action === '*')
			);
		}
	};
}

export const user = createUserStore();

// Derived store for checking if user is authenticated
export const isAuthenticated = derived(user, $user => $user !== null);

// Derived store for user's company ID
export const companyId = derived(user, $user => $user?.companyId ?? null);

// Helper to check permission (can be used in components)
export function checkPermission(module: string, action: string): boolean {
	let currentUser: UserState | null = null;
	user.subscribe(u => (currentUser = u))();
	return user.hasPermission(currentUser, module, action);
}

// Helper to get permission checker function
export function createPermissionChecker(permissions: Array<{ module: string; action: string }>) {
	return (module: string, action: string): boolean => {
		return permissions.some(
			p =>
				(p.module === module && p.action === action) ||
				(p.module === '*' && p.action === '*') ||
				(p.module === module && p.action === '*')
		);
	};
}
