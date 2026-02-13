import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { parseId, createDeleteAction } from '$lib/server/crud-helpers';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'crm', 'read');

	const leadId = parseId(params.id, 'lead');

	const lead = await prisma.lead.findUnique({
		where: { id: leadId },
		include: {
			client: { select: { id: true, name: true } },
			contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, position: true } },
			assignedTo: { select: { id: true, name: true, firstName: true, lastName: true, image: true } },
			createdBy: { select: { id: true, name: true } }
		}
	});

	if (!lead) {
		error(404, 'Lead not found');
	}

	return {
		lead: {
			...lead,
			budget: lead.budget ? Number(lead.budget) : null
		},
		canUpdate: checkPermission(locals, 'crm', 'update'),
		canDelete: checkPermission(locals, 'crm', 'delete')
	};
};

export const actions: Actions = {
	delete: createDeleteAction({
		permission: ['crm', 'delete'],
		module: 'crm',
		entityType: 'Lead',
		model: 'lead',
		findSelect: { id: true, title: true, stage: true, clientName: true },
		auditValues: (record) => ({
			title: record.title,
			stage: record.stage,
			clientName: record.clientName
		})
	})
};
