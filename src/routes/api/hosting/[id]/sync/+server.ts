import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { join } from 'path';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logAction } from '$lib/server/audit';
import { captureScreenshot } from '$lib/server/screenshot';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/uploads';

/**
 * POST /api/hosting/[id]/sync
 * Fetches the latest status from the WordPress site's SmartOffice Connector plugin.
 * Optionally accepts ?endpoint=plugins|themes|core|health for detailed data.
 * Accepts ?action=update with endpoint=plugins|themes to trigger remote updates.
 */
export const POST: RequestHandler = async ({ locals, params, url, request }) => {
	const action = url.searchParams.get('action');
	const isUpdate = action === 'update';

	// Updates require 'update' permission; reads require 'read'
	await requirePermission(locals, 'services', isUpdate ? 'update' : 'read');

	const id = parseInt(params.id);
	if (isNaN(id)) error(400, 'Invalid ID');

	const site = await prisma.hostingSite.findUnique({ where: { id } });
	if (!site) error(404, 'Hosting site not found');

	const endpoint = url.searchParams.get('endpoint') || 'overview';

	if (isUpdate) {
		// Only plugins and themes can be updated
		if (endpoint !== 'plugins' && endpoint !== 'themes') {
			error(400, 'Updates are only supported for plugins and themes');
		}

		try {
			const body = await request.json();
			const wpUrl = `${site.apiUrl}/${endpoint}/update`;

			const response = await fetch(wpUrl, {
				method: 'POST',
				headers: {
					'X-SmartOffice-Key': site.apiKey,
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(120000) // 2 minutes for updates
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => 'Unknown error');
				error(502, `WordPress site returned HTTP ${response.status}: ${errorText.substring(0, 200)}`);
			}

			const data = await response.json();

			// Audit log the update action
			logAction({
				userId: locals.user!.id,
				action: 'updated',
				module: 'services',
				entityId: String(id),
				entityType: 'HostingSite',
				newValues: {
					action: `${endpoint}_update`,
					domain: site.domain,
					updated: data.updated,
					failed: data.failed,
					results: data.results
				}
			});

			return json({ success: true, data });
		} catch (err: unknown) {
			// Don't overwrite SvelteKit errors
			if (err && typeof err === 'object' && 'status' in err) {
				throw err;
			}
			const message = err instanceof Error ? err.message : 'Connection failed';
			error(502, `Could not connect to WordPress site: ${message}`);
		}
	}

	// Regular sync (read) flow
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
