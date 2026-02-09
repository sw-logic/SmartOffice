import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';

// Map entity types to their permission modules
const ENTITY_PERMISSION_MAP: Record<string, string> = {
	'Task': 'projects',
	'Project': 'projects',
	'Client': 'clients',
	'Vendor': 'vendors',
	'Person': 'employees',
	'Income': 'finances.income',
	'Expense': 'finances.expenses',
	'Payment': 'finances.payments',
	'Offer': 'offers',
	'PriceListItem': 'pricelists'
};

const VALID_ENTITY_TYPES = Object.keys(ENTITY_PERMISSION_MAP);

export const GET: RequestHandler = async ({ locals, url }) => {
	const entityType = url.searchParams.get('entityType');
	const entityId = url.searchParams.get('entityId');

	if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
		return json({ error: 'Invalid or missing entityType' }, { status: 400 });
	}

	await requirePermission(locals, ENTITY_PERMISSION_MAP[entityType], 'read');

	if (!entityType || !entityId) {
		return json({ error: 'entityType and entityId are required' }, { status: 400 });
	}

	const notes = await prisma.note.findMany({
		where: { entityType, entityId },
		orderBy: { createdAt: 'desc' },
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

	return json({ notes });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const body = await request.json();
	const { entityType, entityId, content, priority, color } = body;

	if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
		return json({ error: 'Invalid or missing entityType' }, { status: 400 });
	}
	if (!entityId) {
		return json({ error: 'entityId is required' }, { status: 400 });
	}

	await requirePermission(locals, ENTITY_PERMISSION_MAP[entityType], 'update');

	if (!content?.trim()) {
		return json({ error: 'Note content is required' }, { status: 400 });
	}

	const note = await prisma.note.create({
		data: {
			entityType,
			entityId: String(entityId),
			content: content.trim(),
			priority: priority || 'normal',
			color: color || null,
			authorId: locals.user!.id
		},
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

	await logCreate(locals.user!.id, 'projects', String(note.id), 'Note', {
		entityType,
		entityId: String(entityId),
		content: content.trim()
	});

	return json({ note }, { status: 201 });
};
