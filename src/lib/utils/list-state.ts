/**
 * Persists and restores list page URL params via sessionStorage.
 * Allows users to return to their last filter/sort/page view when navigating back.
 */

const PREFIX = 'list:';

export function saveListState(routePath: string, search: string) {
	try {
		sessionStorage.setItem(PREFIX + routePath, search);
	} catch { /* ignore */ }
}

export function restoreListState(routePath: string): string | null {
	try {
		return sessionStorage.getItem(PREFIX + routePath) || null;
	} catch {
		return null;
	}
}
