import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { parseId } from '$lib/server/crud-helpers';
import { logUpdate } from '$lib/server/audit';
import { error, fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'crm', 'update');

	const leadId = parseId(params.id, 'lead');

	const [lead, clients, employees] = await Promise.all([
		prisma.lead.findUnique({
			where: { id: leadId },
			include: {
				client: { select: { id: true, name: true } },
				contact: { select: { id: true, firstName: true, lastName: true } }
			}
		}),
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

	if (!lead) {
		error(404, 'Lead not found');
	}

	return {
		lead: {
			...lead,
			budget: lead.budget ? Number(lead.budget) : null
		},
		clients,
		employees
	};
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		await requirePermission(locals, 'crm', 'update');

		const leadId = parseId(params.id, 'lead');

		const existing = await prisma.lead.findUnique({
			where: { id: leadId },
			select: {
				id: true, title: true, description: true, source: true, stage: true,
				clientId: true, clientName: true, contactId: true, contactName: true,
				assignedToId: true, budget: true, currency: true, estimatedHours: true,
				offerDueDate: true, deadline: true
			}
		});

		if (!existing) {
			error(404, 'Lead not found');
		}

		const formData = await request.formData();
		const title = formData.get('title') as string;
		const description = formData.get('description') as string;
		const source = formData.get('source') as string;
		const stage = formData.get('stage') as string;
		const clientIdStr = formData.get('clientId') as string;
		const contactIdStr = formData.get('contactId') as string;
		const assignedToIdStr = formData.get('assignedToId') as string;
		const budgetStr = formData.get('budget') as string;
		const currency = formData.get('currency') as string;
		const estimatedHoursStr = formData.get('estimatedHours') as string;
		const offerDueDate = formData.get('offerDueDate') as string;
		const deadline = formData.get('deadline') as string;

		if (!title?.trim()) {
			return fail(400, { error: 'Lead title is required' });
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

		const oldValues = {
			title: existing.title,
			description: existing.description,
			source: existing.source,
			stage: existing.stage,
			clientId: existing.clientId,
			contactId: existing.contactId,
			assignedToId: existing.assignedToId,
			budget: existing.budget ? Number(existing.budget) : null,
			currency: existing.currency,
			estimatedHours: existing.estimatedHours,
			offerDueDate: existing.offerDueDate,
			deadline: existing.deadline
		};

		await prisma.lead.update({
			where: { id: leadId },
			data: {
				title: title.trim(),
				description: description?.trim() || null,
				source: source || null,
				stage: stage || existing.stage,
				clientId,
				clientName,
				contactId,
				contactName,
				assignedToId,
				budget,
				currency: currency || 'HUF',
				estimatedHours,
				offerDueDate: offerDueDate ? new Date(offerDueDate) : null,
				deadline: deadline ? new Date(deadline) : null
			}
		});

		await logUpdate(locals.user!.id, 'crm', String(leadId), 'Lead', oldValues, {
			title: title.trim(),
			stage,
			clientId,
			contactId,
			assignedToId,
			budget,
			currency
		});

		redirect(303, `/crm/${leadId}`);
	}
};
