import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logUpdate, logDelete } from '$lib/server/audit';

// Map entity types to their permission modules
const ENTITY_PERMISSION_MAP: Record<string, string> = {
	'Task': 'projects',
	'Project': 'projects',
	'Client': 'clients',
	'Vendor': 'vendors',
	'User': 'settings.users',
	'Income': 'finances.income',
	'Expense': 'finances.expenses',
	'Payment': 'finances.payments',
	'Offer': 'offers',
	'PriceListItem': 'pricelists'
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid note ID' }, { status: 400 });
	}

	const existing = await prisma.note.findUnique({
		where: { id },
		select: { id: true, content: true, priority: true, color: true, entityType: true }
	});

	if (!existing) {
		return json({ error: 'Note not found' }, { status: 404 });
	}

	const permModule = ENTITY_PERMISSION_MAP[existing.entityType] || 'projects';
	await requirePermission(locals, permModule, 'update');

	const body = await request.json();
	const data: Record<string, unknown> = {};
	const oldValues: Record<string, unknown> = {};

	if ('content' in body) {
		if (!body.content?.trim()) {
			return json({ error: 'Note content is required' }, { status: 400 });
		}
		data.content = body.content.trim();
		oldValues.content = existing.content;
	}

	if ('priority' in body) {
		data.priority = body.priority;
		oldValues.priority = existing.priority;
	}

	if ('color' in body) {
		data.color = body.color || null;
		oldValues.color = existing.color;
	}

	const updated = await prisma.note.update({
		where: { id },
		data,
		select: {
			id: true,
			content: true,
			priority: true,
			color: true,
			createdAt: true,
			author: {
				select: { id: true, name: true }
			}
		}
	});

	await logUpdate(locals.user!.id, 'projects', String(id), 'Note', oldValues, body);

	return json({ note: updated });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid note ID' }, { status: 400 });
	}

	const note = await prisma.note.findUnique({
		where: { id },
		select: { id: true, content: true, entityType: true }
	});

	if (!note) {
		return json({ error: 'Note not found' }, { status: 404 });
	}

	const permModule = ENTITY_PERMISSION_MAP[note.entityType] || 'projects';
	await requirePermission(locals, permModule, 'update');

	// Audit log before hard delete
	await logDelete(locals.user!.id, 'projects', String(id), 'Note', {
		content: note.content
	});

	await prisma.note.delete({
		where: { id }
	});

	return json({ success: true });
};
