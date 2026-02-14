import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';

export const POST: RequestHandler = async ({ locals, request }) => {
	await requirePermission(locals, 'services', 'create');

	const data = await request.json();
	const { name, domain, apiUrl, apiKey, serviceId, clientId } = data;

	if (!name || !domain || !apiUrl || !apiKey) {
		error(400, 'Name, domain, API URL and API key are required');
	}

	// Fetch client name for denormalization
	let clientName: string | null = null;
	if (clientId) {
		const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
		clientName = client?.name ?? null;
	}

	const site = await prisma.hostingSite.create({
		data: {
			name,
			domain,
			apiUrl: apiUrl.replace(/\/+$/, ''), // strip trailing slashes
			apiKey,
			serviceId: serviceId || null,
			clientId: clientId || null,
			clientName,
			createdById: locals.user!.id
		}
	});

	await logCreate(locals.user!.id, 'services', String(site.id), 'HostingSite', { name, domain });

	return json(site, { status: 201 });
};
