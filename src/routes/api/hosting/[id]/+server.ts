import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logUpdate, logDelete } from '$lib/server/audit';

export const GET: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'services', 'read');

	const id = parseInt(params.id);
	if (isNaN(id)) error(400, 'Invalid ID');

	const site = await prisma.hostingSite.findUnique({
		where: { id },
		include: {
			service: { select: { id: true, name: true } },
			client: { select: { id: true, name: true } },
			createdBy: { select: { id: true, name: true } }
		}
	});

	if (!site) error(404, 'Hosting site not found');

	return json(site);
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	await requirePermission(locals, 'services', 'update');

	const id = parseInt(params.id);
	if (isNaN(id)) error(400, 'Invalid ID');

	const existing = await prisma.hostingSite.findUnique({ where: { id } });
	if (!existing) error(404, 'Hosting site not found');

	const data = await request.json();
	const { name, domain, apiUrl, apiKey, serviceId, clientId } = data;

	// Fetch client name for denormalization
	let clientName: string | null = existing.clientName;
	if (clientId && clientId !== existing.clientId) {
		const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
		clientName = client?.name ?? null;
	} else if (!clientId) {
		clientName = null;
	}

	const site = await prisma.hostingSite.update({
		where: { id },
		data: {
			...(name !== undefined && { name }),
			...(domain !== undefined && { domain }),
			...(apiUrl !== undefined && { apiUrl: apiUrl.replace(/\/+$/, '') }),
			...(apiKey !== undefined && { apiKey }),
			serviceId: serviceId ?? null,
			clientId: clientId ?? null,
			clientName
		}
	});

	await logUpdate(
		locals.user!.id, 'services', String(site.id), 'HostingSite',
		{ name: existing.name, domain: existing.domain },
		{ name: site.name, domain: site.domain }
	);

	return json(site);
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'services', 'delete');

	const id = parseInt(params.id);
	if (isNaN(id)) error(400, 'Invalid ID');

	const site = await prisma.hostingSite.findUnique({ where: { id } });
	if (!site) error(404, 'Hosting site not found');

	await logDelete(
		locals.user!.id, 'services', String(site.id), 'HostingSite',
		{ name: site.name, domain: site.domain }
	);

	await prisma.hostingSite.delete({ where: { id } });

	return json({ success: true });
};
