import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { join } from 'path';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { captureScreenshot } from '$lib/server/screenshot';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/uploads';

/**
 * POST /api/hosting/[id]/sync
 * Fetches the latest status from the WordPress site's SmartOffice Connector plugin.
 * Optionally accepts ?endpoint=plugins|themes|core|health for detailed data.
 */
export const POST: RequestHandler = async ({ locals, params, url }) => {
	await requirePermission(locals, 'services', 'read');

	const id = parseInt(params.id);
	if (isNaN(id)) error(400, 'Invalid ID');

	const site = await prisma.hostingSite.findUnique({ where: { id } });
	if (!site) error(404, 'Hosting site not found');

	const endpoint = url.searchParams.get('endpoint') || 'overview';
	const validEndpoints = ['overview', 'plugins', 'themes', 'core', 'health'];
	if (!validEndpoints.includes(endpoint)) {
		error(400, `Invalid endpoint. Must be one of: ${validEndpoints.join(', ')}`);
	}

	try {
		const response = await fetch(`${site.apiUrl}/${endpoint}`, {
			headers: {
				'X-SmartOffice-Key': site.apiKey,
				'Accept': 'application/json'
			},
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unknown error');
			// Update site status to indicate error
			await prisma.hostingSite.update({
				where: { id },
				data: {
					lastSyncError: `HTTP ${response.status}: ${errorText.substring(0, 500)}`,
					lastSyncAt: new Date(),
					...(response.status === 401 && { status: 'unknown' })
				}
			});
			error(502, `WordPress site returned HTTP ${response.status}: ${errorText.substring(0, 200)}`);
		}

		const data = await response.json();

		// If it's the overview endpoint, update cached fields
		if (endpoint === 'overview') {
			await prisma.hostingSite.update({
				where: { id },
				data: {
					status: data.status ?? 'unknown',
					wpVersion: data.wp_version ?? null,
					phpVersion: data.php_version ?? null,
					coreUpdate: data.core_update ?? false,
					pluginUpdates: data.plugin_updates ?? 0,
					themeUpdates: data.theme_updates ?? 0,
					totalUpdates: data.total_updates ?? 0,
					activePlugins: data.active_plugins ?? 0,
					lastSyncData: data,
					lastSyncAt: new Date(),
					lastSyncError: null
				}
			});

			// Capture desktop screenshot (non-blocking — sync succeeds even if this fails)
			const relativePath = `hosting/thumbnails/${id}.png`;
			const absolutePath = join(UPLOAD_DIR, relativePath);
			captureScreenshot(`https://${site.domain}`, absolutePath, relativePath)
				.then(async (path) => {
					if (path) {
						await prisma.hostingSite.update({
							where: { id },
							data: { thumbnailPath: path }
						});
					}
				})
				.catch(() => { /* screenshot failed, ignore */ });
		}

		return json({ success: true, data });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Connection failed';

		// Don't overwrite SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		await prisma.hostingSite.update({
			where: { id },
			data: {
				status: 'offline',
				lastSyncError: message.substring(0, 500),
				lastSyncAt: new Date()
			}
		});

		error(502, `Could not connect to WordPress site: ${message}`);
	}
};
