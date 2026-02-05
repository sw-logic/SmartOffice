import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const error = url.searchParams.get('error');
	const callbackUrl = url.searchParams.get('callbackUrl') || '/dashboard';

	let errorMessage = '';
	if (error === 'access_denied') {
		errorMessage = 'You do not have permission to access that page. Please sign in with an authorized account.';
	} else if (error === 'session_expired') {
		errorMessage = 'Your session has expired. Please sign in again.';
	} else if (error) {
		errorMessage = 'Invalid credentials. Please try again.';
	}

	return {
		errorMessage,
		callbackUrl
	};
};
