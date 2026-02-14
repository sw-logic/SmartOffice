import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logAction } from '$lib/server/audit';

/**
 * POST /api/hosting/[id]/login
 * Requests a one-time auto-login token from the WordPress site
 * and returns the login URL for the browser to open.
 */
export const POST: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'services', 'update');

	const id = parseInt(params.id);
	if (isNaN(id)) error(400, 'Invalid ID');

	const site = await prisma.hostingSite.findUnique({ where: { id } });
	if (!site) error(404, 'Hosting site not found');

	const requesterName = locals.user!.name;

	try {
		const response = await fetch(`${site.apiUrl}/auth/token`, {
			method: 'POST',
			headers: {
				'X-SmartOffice-Key': site.apiKey,
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify({ requester: requesterName }),
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unknown error');
			error(502, `WordPress site returned ${response.status}: ${errorText.substring(0, 200)}`);
		}

		const data = await response.json();

		if (!data.login_url) {
			error(502, 'WordPress plugin did not return a login URL');
		}

		// Audit log the auto-login action
		await logAction({
			userId: locals.user!.id,
			action: 'login',
			module: 'services',
			entityId: String(site.id),
			entityType: 'HostingSite',
			newValues: { domain: site.domain, requester: requesterName }
		});

		return json({
			loginUrl: data.login_url,
			expiresIn: data.expires_in ?? 30
		});
	} catch (err: unknown) {
		// Don't overwrite SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		const message = err instanceof Error ? err.message : 'Connection failed';
		error(502, `Could not connect to WordPress site: ${message}`);
	}
};
