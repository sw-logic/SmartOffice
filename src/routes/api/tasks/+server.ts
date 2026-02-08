import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';

export const POST: RequestHandler = async ({ locals, request }) => {
	await requirePermission(locals, 'projects', 'update');

	const body = await request.json();
	const { name, projectId } = body;

	if (!name?.trim()) {
		return json({ error: 'Task name is required' }, { status: 400 });
	}
	if (!projectId) {
		return json({ error: 'Project is required' }, { status: 400 });
	}
	if (!body.dueDate) {
		return json({ error: 'Due date is required' }, { status: 400 });
	}
	if (!body.estimatedTime || Math.round(Number(body.estimatedTime)) <= 0) {
		return json({ error: 'Estimated time is required and must be greater than 0' }, { status: 400 });
	}

	const project = await prisma.project.findUnique({
		where: { id: projectId },
		select: { id: true }
	});

	if (!project) {
		return json({ error: 'Project not found' }, { status: 404 });
	}

	const task = await prisma.task.create({
		data: {
			name: name.trim(),
			projectId,
			createdById: locals.user!.id,
			status: body.status || 'todo',
			priority: body.priority || 'medium',
			type: body.type || null,
			category: body.category || null,
			description: body.description || null,
			kanbanBoardId: body.kanbanBoardId || null,
			columnId: body.columnId || null,
			swimlaneId: body.swimlaneId || null,
			assignedToId: body.assignedToId || null,
			dueDate: body.dueDate ? new Date(body.dueDate) : null,
			estimatedTime: body.estimatedTime ? Math.round(Number(body.estimatedTime)) : null,
			reviewerIds: body.reviewerIds || [],
			followerIds: body.followerIds || []
		}
	});

	await logCreate(locals.user!.id, 'projects', String(task.id), 'Task', {
		name: task.name,
		projectId: task.projectId
	});

	return json({ task }, { status: 201 });
};
