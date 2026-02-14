import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { createDeleteAction, createBulkDeleteAction } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'services', 'read');

	const sites = await prisma.hostingSite.findMany({
		orderBy: { name: 'asc' },
		include: {
			service: { select: { id: true, name: true } },
			client: { select: { id: true, name: true } },
			createdBy: { select: { id: true, name: true } }
		}
	});

	// Clients for the add form
	const clients = await prisma.client.findMany({
		where: { status: 'active' },
		orderBy: { name: 'asc' },
		select: { id: true, name: true }
	});

	// Services for the add form
	const services = await prisma.service.findMany({
		where: { status: 'active' },
		orderBy: { name: 'asc' },
		select: { id: true, name: true }
	});

	return {
		sites,
		clients,
		services,
		canCreate: checkPermission(locals, 'services', 'create'),
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
	}),
	bulkDelete: createBulkDeleteAction({
		permission: ['services', 'delete'],
		module: 'services',
		entityType: 'HostingSite',
		model: 'hostingSite',
		findSelect: { id: true, name: true, domain: true },
		auditValues: (record) => ({ name: record.name, domain: record.domain })
	})
};
