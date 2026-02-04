import { handle as authHandle } from './auth';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

// Authorization handle - protect routes
const authorizationHandle: Handle = async ({ event, resolve }) => {
	const session = await event.locals.auth();

	// Define public routes
	const publicRoutes = ['/login', '/register', '/auth'];
	const isPublicRoute = publicRoutes.some(route => event.url.pathname.startsWith(route));

	// Redirect unauthenticated users from protected routes
	if (!session?.user && !isPublicRoute && event.url.pathname !== '/') {
		redirect(303, `/login?callbackUrl=${encodeURIComponent(event.url.pathname)}`);
	}

	// Redirect authenticated users from auth pages to dashboard
	if (session?.user && (event.url.pathname === '/login' || event.url.pathname === '/register')) {
		redirect(303, '/dashboard');
	}

	// Redirect root to dashboard for authenticated users
	if (session?.user && event.url.pathname === '/') {
		redirect(303, '/dashboard');
	}

	// Add user to event.locals for easy access
	if (session?.user) {
		event.locals.user = {
			id: session.user.id as string,
			email: session.user.email as string,
			name: session.user.name as string,
			companyId: (session.user as unknown as { companyId?: string }).companyId
		};
	}

	return resolve(event);
};

export const handle = sequence(authHandle, authorizationHandle);
