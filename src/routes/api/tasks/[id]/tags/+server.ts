import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate, logDelete } from '$lib/server/audit';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	await requirePermission(locals, 'projects', 'update');

	const taskId = parseInt(params.id);
	if (isNaN(taskId)) {
		return json({ error: 'Invalid task ID' }, { status: 400 });
	}

	const task = await prisma.task.findUnique({
		where: { id: taskId },
		select: { id: true }
	});

	if (!task) {
		return json({ error: 'Task not found' }, { status: 404 });
	}

	const body = await request.json();
	const { enumValueId } = body;

	if (!enumValueId) {
		return json({ error: 'Tag enum value ID is required' }, { status: 400 });
	}

	// Check if tag already exists
	const existing = await prisma.entityTag.findUnique({
		where: {
			entityType_entityId_enumValueId: {
				entityType: 'Task',
				entityId: String(taskId),
				enumValueId
			}
		}
	});

	if (existing) {
		return json({ error: 'Tag already applied' }, { status: 409 });
	}

	const tag = await prisma.entityTag.create({
		data: {
			entityType: 'Task',
			entityId: String(taskId),
			enumValueId
		},
		select: {
			id: true,
			enumValueId: true,
			enumValue: {
				select: { id: true, value: true, label: true, color: true }
			}
		}
	});

	await logCreate(locals.user!.id, 'projects', String(tag.id), 'EntityTag', {
		entityType: 'Task',
		entityId: String(taskId),
		enumValueId
	});

	return json({ tag }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	await requirePermission(locals, 'projects', 'update');

	const taskId = parseInt(params.id);
	if (isNaN(taskId)) {
		return json({ error: 'Invalid task ID' }, { status: 400 });
	}

	const body = await request.json();
	const { entityTagId } = body;

	if (!entityTagId) {
		return json({ error: 'Entity tag ID is required' }, { status: 400 });
	}

	const tag = await prisma.entityTag.findUnique({
		where: { id: entityTagId },
		select: { id: true, entityType: true, entityId: true, enumValueId: true }
	});

	if (!tag || tag.entityType !== 'Task' || tag.entityId !== String(taskId)) {
		return json({ error: 'Tag not found' }, { status: 404 });
	}

	await prisma.entityTag.delete({
		where: { id: entityTagId }
	});

	await logDelete(locals.user!.id, 'projects', String(entityTagId), 'EntityTag', {
		entityType: 'Task',
		entityId: String(taskId),
		enumValueId: tag.enumValueId
	});

	return json({ success: true });
};
