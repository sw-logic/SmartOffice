import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logUpdate, logDelete } from '$lib/server/audit';

export const GET: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'crm', 'read');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid lead ID' }, { status: 400 });
	}

	const lead = await prisma.lead.findUnique({
		where: { id },
		include: {
			client: { select: { id: true, name: true } },
			contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, position: true } },
			assignedTo: { select: { id: true, name: true, firstName: true, lastName: true, image: true } },
			createdBy: { select: { id: true, name: true } }
		}
	});

	if (!lead) {
		return json({ error: 'Lead not found' }, { status: 404 });
	}

	return json({
		lead: {
			...lead,
			budget: lead.budget ? Number(lead.budget) : null
		}
	});
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	await requirePermission(locals, 'crm', 'update');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid lead ID' }, { status: 400 });
	}

	const existing = await prisma.lead.findUnique({
		where: { id },
		select: {
			id: true, title: true, description: true, source: true, stage: true, order: true,
			clientId: true, clientName: true, contactId: true, contactName: true,
			assignedToId: true, budget: true, currency: true, estimatedHours: true,
			offerDueDate: true, deadline: true
		}
	});

	if (!existing) {
		return json({ error: 'Lead not found' }, { status: 404 });
	}

	const body = await request.json();
	const data: Record<string, unknown> = {};
	const oldValues: Record<string, unknown> = {};

	const allowedFields = [
		'title', 'description', 'source', 'stage', 'order',
		'assignedToId', 'currency'
	];

	for (const field of allowedFields) {
		if (field in body) {
			data[field] = body[field];
			oldValues[field] = (existing as Record<string, unknown>)[field];
		}
	}

	// Handle client change with denormalization
	if ('clientId' in body) {
		data.clientId = body.clientId || null;
		oldValues.clientId = existing.clientId;
		if (body.clientId) {
			const client = await prisma.client.findUnique({ where: { id: body.clientId }, select: { name: true } });
			data.clientName = client?.name ?? null;
		} else {
			data.clientName = null;
		}
	}

	// Handle contact change with denormalization
	if ('contactId' in body) {
		data.contactId = body.contactId || null;
		oldValues.contactId = existing.contactId;
		if (body.contactId) {
			const contact = await prisma.contact.findUnique({ where: { id: body.contactId }, select: { firstName: true, lastName: true } });
			data.contactName = contact ? `${contact.firstName} ${contact.lastName}` : null;
		} else {
			data.contactName = null;
		}
	}

	// Handle special fields
	if ('budget' in body) {
		data.budget = body.budget ? Number(body.budget) : null;
		oldValues.budget = existing.budget ? Number(existing.budget) : null;
	}
	if ('estimatedHours' in body) {
		data.estimatedHours = body.estimatedHours ? Math.round(Number(body.estimatedHours)) : null;
		oldValues.estimatedHours = existing.estimatedHours;
	}
	if ('offerDueDate' in body) {
		data.offerDueDate = body.offerDueDate ? new Date(body.offerDueDate) : null;
		oldValues.offerDueDate = existing.offerDueDate;
	}
	if ('deadline' in body) {
		data.deadline = body.deadline ? new Date(body.deadline) : null;
		oldValues.deadline = existing.deadline;
	}

	const updated = await prisma.lead.update({
		where: { id },
		data
	});

	await logUpdate(locals.user!.id, 'crm', String(id), 'Lead', oldValues, body);

	return json({
		lead: {
			...updated,
			budget: updated.budget ? Number(updated.budget) : null
		}
	});
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'crm', 'delete');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid lead ID' }, { status: 400 });
	}

	const lead = await prisma.lead.findUnique({
		where: { id },
		select: { id: true, title: true, stage: true, clientName: true }
	});

	if (!lead) {
		return json({ error: 'Lead not found' }, { status: 404 });
	}

	await logDelete(locals.user!.id, 'crm', String(id), 'Lead', {
		title: lead.title,
		stage: lead.stage,
		clientName: lead.clientName
	});

	await prisma.lead.delete({ where: { id } });

	return json({ success: true });
};
