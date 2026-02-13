import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';

export const POST: RequestHandler = async ({ locals, request }) => {
	await requirePermission(locals, 'crm', 'create');

	const body = await request.json();
	const { title, description, source, stage, clientId, contactId, assignedToId, budget, currency, estimatedHours, offerDueDate, deadline } = body;

	if (!title?.trim()) {
		return json({ error: 'Lead title is required' }, { status: 400 });
	}

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

	// Calculate max order for the target stage
	const targetStage = stage || 'lead';
	const maxOrder = await prisma.lead.aggregate({
		where: { stage: targetStage },
		_max: { order: true }
	});

	const lead = await prisma.lead.create({
		data: {
			title: title.trim(),
			description: description?.trim() || null,
			source: source || null,
			stage: targetStage,
			order: (maxOrder._max.order ?? -1) + 1,
			clientId: clientId || null,
			clientName,
			contactId: contactId || null,
			contactName,
			assignedToId: assignedToId || null,
			budget: budget ? Number(budget) : null,
			currency: currency || 'HUF',
			estimatedHours: estimatedHours ? Math.round(Number(estimatedHours)) : null,
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

	return json({ lead }, { status: 201 });
};
