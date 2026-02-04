import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

// Get initial theme from localStorage or default to 'system'
function getInitialTheme(): Theme {
	if (!browser) return 'system';

	const stored = localStorage.getItem('theme') as Theme | null;
	if (stored && ['light', 'dark', 'system'].includes(stored)) {
		return stored;
	}
	return 'system';
}

// Get the actual theme (resolving 'system' to light/dark)
function getResolvedTheme(theme: Theme): 'light' | 'dark' {
	if (theme === 'system') {
		if (!browser) return 'light';
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}
	return theme;
}

// Create the theme store
function createThemeStore() {
	const { subscribe, set, update } = writable<Theme>(getInitialTheme());

	// Apply theme to document
	function applyTheme(theme: Theme) {
		if (!browser) return;

		const resolved = getResolvedTheme(theme);
		const root = document.documentElement;

		if (resolved === 'dark') {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}

		// Store preference
		localStorage.setItem('theme', theme);
	}

	// Initialize theme on client
	if (browser) {
		// Apply initial theme
		applyTheme(getInitialTheme());

		// Listen for system theme changes
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		mediaQuery.addEventListener('change', () => {
			const currentTheme = get({ subscribe });
			if (currentTheme === 'system') {
				applyTheme('system');
			}
		});
	}

	return {
		subscribe,
		set: (theme: Theme) => {
			set(theme);
			applyTheme(theme);
		},
		toggle: () => {
			update(current => {
				const resolved = getResolvedTheme(current);
				const newTheme = resolved === 'light' ? 'dark' : 'light';
				applyTheme(newTheme);
				return newTheme;
			});
		},
		setSystem: () => {
			set('system');
			applyTheme('system');
		},
		getResolved: (): 'light' | 'dark' => {
			return getResolvedTheme(get({ subscribe }));
		}
	};
}

export const theme = createThemeStore();

// Derived store for the actual theme (light/dark)
export const resolvedTheme = {
	subscribe: (callback: (value: 'light' | 'dark') => void) => {
		return theme.subscribe(t => callback(getResolvedTheme(t)));
	}
};
