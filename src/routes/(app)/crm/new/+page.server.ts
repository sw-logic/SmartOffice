import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'crm', 'create');

	const [clients, employees] = await Promise.all([
		prisma.client.findMany({
			where: { status: 'active' },
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				contacts: {
					orderBy: [{ isPrimaryContact: 'desc' }, { lastName: 'asc' }],
					select: { id: true, firstName: true, lastName: true, position: true }
				}
			}
		}),
		prisma.user.findMany({
			where: { employeeStatus: 'active' },
			orderBy: { name: 'asc' },
			select: { id: true, name: true, firstName: true, lastName: true }
		})
	]);

	return { clients, employees };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		await requirePermission(locals, 'crm', 'create');

		const formData = await request.formData();
		const title = formData.get('title') as string;
		const description = formData.get('description') as string;
		const source = formData.get('source') as string;
		const clientIdStr = formData.get('clientId') as string;
		const contactIdStr = formData.get('contactId') as string;
		const assignedToIdStr = formData.get('assignedToId') as string;
		const budgetStr = formData.get('budget') as string;
		const currency = formData.get('currency') as string;
		const estimatedHoursStr = formData.get('estimatedHours') as string;
		const offerDueDate = formData.get('offerDueDate') as string;
		const deadline = formData.get('deadline') as string;

		if (!title?.trim()) {
			return fail(400, { error: 'Lead title is required', values: { title, description, source, clientId: clientIdStr, contactId: contactIdStr, assignedToId: assignedToIdStr, budget: budgetStr, currency, estimatedHours: estimatedHoursStr, offerDueDate, deadline } });
		}

		const clientId = clientIdStr ? parseInt(clientIdStr) : null;
		const contactId = contactIdStr ? parseInt(contactIdStr) : null;
		const assignedToId = assignedToIdStr ? parseInt(assignedToIdStr) : null;
		const budget = budgetStr ? Number(budgetStr) : null;
		const estimatedHours = estimatedHoursStr ? Math.round(Number(estimatedHoursStr)) : null;

		// Denormalize names
		let clientName: string | null = null;
		let contactName: string | null = null;

		if (clientId) {
			const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
			clientName = client?.name ?? null;
		}
		if (contactId) {
			const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { firstName: true, lastName: true } });
			contactName = contact ? `${contact.firstName} ${contact.lastName}` : null;
		}

		// Calculate max order for lead stage
		const maxOrder = await prisma.lead.aggregate({
			where: { stage: 'lead' },
			_max: { order: true }
		});

		const lead = await prisma.lead.create({
			data: {
				title: title.trim(),
				description: description?.trim() || null,
				source: source || null,
				stage: 'lead',
				order: (maxOrder._max.order ?? -1) + 1,
				clientId,
				clientName,
				contactId,
				contactName,
				assignedToId,
				budget,
				currency: currency || 'HUF',
				estimatedHours,
				offerDueDate: offerDueDate ? new Date(offerDueDate) : null,
				deadline: deadline ? new Date(deadline) : null,
				createdById: locals.user!.id
			}
		});

		await logCreate(locals.user!.id, 'crm', String(lead.id), 'Lead', {
			title: lead.title,
			stage: lead.stage,
			clientName
		});

		redirect(303, `/crm/${lead.id}`);
	}
};
