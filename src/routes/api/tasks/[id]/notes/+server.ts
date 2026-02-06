import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';

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
	const { content, priority, color } = body;

	if (!content?.trim()) {
		return json({ error: 'Note content is required' }, { status: 400 });
	}

	const note = await prisma.note.create({
		data: {
			entityType: 'Task',
			entityId: String(taskId),
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
		entityType: 'Task',
		entityId: String(taskId),
		content: content.trim()
	});

	return json({ note }, { status: 201 });
};
