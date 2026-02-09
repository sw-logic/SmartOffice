import { handle as authHandle } from './auth';
import { error, redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { prisma } from '$lib/server/prisma';
import { loadUserPermissions } from '$lib/server/access-control';
import { loginLimiter, apiMutationLimiter, apiReadLimiter } from '$lib/server/rate-limit';
import { getCachedUserValidity, setCachedUserValidity } from '$lib/server/user-cache';

// Rate limiting handle
// - Login (auth callback): 5 attempts / minute per IP (prevents brute-forcing)
// - Mutating API requests:  100 / minute per IP (prevents resource spam)
// - Read API requests:      200 / minute per IP (prevents scraping / DoS)
const rateLimitHandle: Handle = async ({ event, resolve }) => {
	const { url, request } = event;
	const method = request.method.toUpperCase();
	const path = url.pathname;

	let clientIp: string;
	try {
		clientIp = event.getClientAddress();
	} catch {
		clientIp = 'unknown';
	}

	// ── Login rate limiting (strictest) ──
	if (path.startsWith('/auth/callback/credentials') && method === 'POST') {
		const result = loginLimiter.check(clientIp);
		if (!result.allowed) {
			return new Response(
				JSON.stringify({ error: 'Too many login attempts. Please try again later.' }),
				{
					status: 429,
					headers: {
						'Content-Type': 'application/json',
						'Retry-After': String(result.retryAfterSeconds)
					}
				}
			);
		}
		return resolve(event);
	}

	// ── API rate limiting ──
	if (path.startsWith('/api/')) {
		const isMutation = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
		const limiter = isMutation ? apiMutationLimiter : apiReadLimiter;
		const result = limiter.check(clientIp);

		if (!result.allowed) {
			return new Response(
				JSON.stringify({ error: 'Too many requests. Please slow down.' }),
				{
					status: 429,
					headers: {
						'Content-Type': 'application/json',
						'Retry-After': String(result.retryAfterSeconds),
						'X-RateLimit-Remaining': '0'
					}
				}
			);
		}
	}

	return resolve(event);
};

// CSRF protection for JSON API endpoints
// SvelteKit's built-in CSRF only covers form submissions (application/x-www-form-urlencoded,
// multipart/form-data). This handle extends that protection to JSON API requests by validating
// the Origin header against the server's own origin on all mutating HTTP methods.
const csrfHandle: Handle = async ({ event, resolve }) => {
	const { request, url } = event;
	const method = request.method.toUpperCase();

	// Only check mutating methods
	if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
		return resolve(event);
	}

	// Skip CSRF check for Auth.js callback routes (they handle their own verification)
	if (url.pathname.startsWith('/auth/')) {
		return resolve(event);
	}

	// Determine the expected origin from the request URL
	const expectedOrigin = url.origin;

	// Check Origin header first, fall back to Referer
	const origin = request.headers.get('origin');
	const referer = request.headers.get('referer');

	if (origin) {
		// Origin header present — must match exactly
		if (origin !== expectedOrigin) {
			throw error(403, 'Cross-site request blocked: Origin mismatch');
		}
	} else if (referer) {
		// No Origin header — validate Referer as fallback
		try {
			const refererOrigin = new URL(referer).origin;
			if (refererOrigin !== expectedOrigin) {
				throw error(403, 'Cross-site request blocked: Referer mismatch');
			}
		} catch {
			throw error(403, 'Cross-site request blocked: Invalid Referer');
		}
	} else {
		// Neither Origin nor Referer present on a mutating request — block it.
		// Legitimate browser requests always include at least one of these headers.
		throw error(403, 'Cross-site request blocked: Missing Origin header');
	}

	return resolve(event);
};

// Security headers handle
const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-XSS-Protection', '1; mode=block');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (event.url.protocol === 'https:') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}
	return response;
};

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

	// Validate session - check if user still exists.
	// Uses an in-memory cache (5-min TTL) so the DB is only hit once per user
	// per TTL window instead of on every single request.
	let isValidSession = false;
	if (session?.user) {
		// Auth.js stores id as string; convert to Int for our DB
		const userId = parseInt(session.user.id as string);
		const cacheKey = String(userId);
		const cached = getCachedUserValidity(cacheKey);

		if (cached !== null) {
			isValidSession = cached;
		} else {
			try {
				const user = await prisma.user.findUnique({
					where: { id: userId },
					select: { id: true, companyId: true }
				});
				isValidSession = !!user;
				setCachedUserValidity(cacheKey, isValidSession);
			} catch (err) {
				// Re-throw redirects (they're thrown as exceptions in SvelteKit)
				if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
					throw err;
				}
				// Database error — don't cache, retry on next request
				console.error('Session validation error:', err);
				if (!isPublicRoute) {
					redirect(303, `/login?error=session_expired`);
				}
			}
		}

		if (!isValidSession && !isPublicRoute) {
			redirect(303, `/login?callbackUrl=${encodeURIComponent(event.url.pathname)}&error=session_expired`);
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
		const userId = parseInt(session.user.id as string);

		// Load user's companyId from DB (cached via session validation above)
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { companyId: true }
		});

		event.locals.user = {
			id: userId,
			email: session.user.email as string,
			name: session.user.name as string,
			companyId: user?.companyId ?? undefined
		};

		// Load permissions once for the entire request — all downstream
		// checkPermission / requirePermission calls read from this Set.
		event.locals.permissions = await loadUserPermissions(userId);
	}

	return resolve(event);
};

export const handle = sequence(rateLimitHandle, csrfHandle, securityHeadersHandle, authHandle, authorizationHandle);
