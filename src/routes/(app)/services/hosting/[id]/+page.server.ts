import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { parseId, createDeleteAction } from '$lib/server/crud-helpers';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'services', 'read');

	const siteId = parseId(params.id, 'hosting site');

	const site = await prisma.hostingSite.findUnique({
		where: { id: siteId },
		include: {
			service: { select: { id: true, name: true } },
			client: { select: { id: true, name: true } },
			createdBy: { select: { id: true, name: true } }
		}
	});

	if (!site) {
		error(404, 'Hosting site not found');
	}

	// Clients and services for the edit modal
	const clients = await prisma.client.findMany({
		where: { status: 'active' },
		orderBy: { name: 'asc' },
		select: { id: true, name: true }
	});

	const services = await prisma.service.findMany({
		where: { status: 'active' },
		orderBy: { name: 'asc' },
		select: { id: true, name: true }
	});

	return {
		site,
		clients,
		services,
		canUpdate: checkPermission(locals, 'services', 'update'),
		canDelete: checkPermission(locals, 'services', 'delete')
	};
};

export const actions: Actions = {
	delete: createDeleteAction({
		permission: ['services', 'delete'],
		module: 'services',
		entityType: 'HostingSite',
		model: 'hostingSite',
		findSelect: { id: true, name: true, domain: true },
		auditValues: (record) => ({ name: record.name, domain: record.domain })
	})
};
