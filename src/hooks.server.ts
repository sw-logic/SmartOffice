import { handle as authHandle } from './auth';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { prisma } from '$lib/server/prisma';

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

	// Validate session - check if user still exists and is not deleted
	let isValidSession = false;
	if (session?.user) {
		try {
			const user = await prisma.user.findUnique({
				where: { id: session.user.id as string },
				select: { id: true, deletedAt: true }
			});

			// Session is valid only if user exists and is not deleted
			isValidSession = !!(user && !user.deletedAt);

			// If on protected route and session is invalid, redirect to login
			if (!isValidSession && !isPublicRoute) {
				redirect(303, `/login?callbackUrl=${encodeURIComponent(event.url.pathname)}&error=session_expired`);
			}
		} catch (err) {
			// Re-throw redirects (they're thrown as exceptions in SvelteKit)
			if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
				throw err;
			}
			// Database error - redirect to login with session expired
			console.error('Session validation error:', err);
			if (!isPublicRoute) {
				redirect(303, `/login?error=session_expired`);
			}
		}
	}

	// Redirect authenticated users (with valid session) from auth pages to dashboard
	if (isValidSession && (event.url.pathname === '/login' || event.url.pathname === '/register')) {
		redirect(303, '/dashboard');
	}

	// Redirect root to dashboard for authenticated users (with valid session)
	if (isValidSession && event.url.pathname === '/') {
		redirect(303, '/dashboard');
	}

	// Add user to event.locals for easy access (only if valid session)
	if (isValidSession && session?.user) {
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
