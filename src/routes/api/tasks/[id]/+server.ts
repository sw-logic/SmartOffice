import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, canAccessProject } from '$lib/server/access-control';
import { logUpdate, logDelete } from '$lib/server/audit';

export const GET: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'projects', 'read');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid task ID' }, { status: 400 });
	}

	const task = await prisma.task.findUnique({
		where: { id },
		include: {
			project: {
				select: {
					id: true,
					name: true,
					clientId: true,
					client: { select: { id: true, name: true } },
					kanbanBoards: {
						select: {
							id: true,
							name: true,
							columns: {
								orderBy: { order: 'asc' },
								select: { id: true, name: true }
							},
							swimlanes: {
								orderBy: { order: 'asc' },
								select: { id: true, name: true }
							}
						}
					}
				}
			},
			assignedTo: {
				select: { id: true, firstName: true, lastName: true }
			},
			kanbanBoard: {
				select: { id: true, name: true }
			},
			column: {
				select: { id: true, name: true }
			},
			swimlane: {
				select: { id: true, name: true }
			},
			createdBy: {
				select: { id: true, name: true }
			},
			timeRecords: {
				orderBy: { date: 'desc' },
				select: {
					id: true,
					date: true,
					minutes: true,
					description: true,
					type: true,
					category: true,
					billable: true,
					personId: true,
					person: {
						select: { id: true, firstName: true, lastName: true }
					},
					createdById: true,
					createdBy: {
						select: { id: true, name: true }
					},
					createdAt: true
				}
			}
		}
	});

	if (!task) {
		return json({ error: 'Task not found' }, { status: 404 });
	}

	// Row-level access: verify user can access this task's project
	if (!(await canAccessProject(locals, task.project.id))) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	// Load notes (polymorphic)
	const notes = await prisma.note.findMany({
		where: { entityType: 'Task', entityId: String(id) },
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

	// Load tags (polymorphic via EntityTag)
	const tags = await prisma.entityTag.findMany({
		where: { entityType: 'Task', entityId: String(id) },
		select: {
			id: true,
			enumValueId: true,
			enumValue: {
				select: { id: true, value: true, label: true, color: true }
			}
		}
	});

	// Resolve reviewer and follower persons
	const personIds = [...new Set([...task.reviewerIds, ...task.followerIds])];
	const persons = personIds.length > 0
		? await prisma.person.findMany({
				where: { id: { in: personIds } },
				select: { id: true, firstName: true, lastName: true }
			})
		: [];

	const personsMap = new Map(persons.map(p => [p.id, p]));

	const reviewers = task.reviewerIds
		.map(id => personsMap.get(id))
		.filter(Boolean);
	const followers = task.followerIds
		.map(id => personsMap.get(id))
		.filter(Boolean);

	return json({
		task: {
			...task,
			reviewers,
			followers
		},
		notes,
		tags
	});
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	await requirePermission(locals, 'projects', 'update');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid task ID' }, { status: 400 });
	}

	const existing = await prisma.task.findUnique({
		where: { id },
		select: {
			id: true,
			name: true,
			description: true,
			type: true,
			category: true,
			status: true,
			priority: true,
			projectId: true,
			kanbanBoardId: true,
			columnId: true,
			swimlaneId: true,
			assignedToId: true,
			startDate: true,
			dueDate: true,
			estimatedTime: true,
			reviewerIds: true,
			followerIds: true
		}
	});

	if (!existing) {
		return json({ error: 'Task not found' }, { status: 404 });
	}

	// Row-level access: verify user can access this task's project
	if (!(await canAccessProject(locals, existing.projectId))) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body = await request.json();
	const data: Record<string, unknown> = {};
	const oldValues: Record<string, unknown> = {};

	// Map allowed fields
	const allowedFields = [
		'name', 'description', 'type', 'category', 'status', 'priority',
		'projectId', 'kanbanBoardId', 'columnId', 'swimlaneId',
		'assignedToId', 'reviewerIds', 'followerIds'
	];

	for (const field of allowedFields) {
		if (field in body) {
			data[field] = body[field];
			oldValues[field] = (existing as Record<string, unknown>)[field];
		}
	}

	// Handle special fields
	if ('startDate' in body) {
		data.startDate = body.startDate ? new Date(body.startDate) : null;
		oldValues.startDate = existing.startDate;
	}
	if ('dueDate' in body) {
		data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
		oldValues.dueDate = existing.dueDate;
	}
	if ('estimatedTime' in body) {
		data.estimatedTime = body.estimatedTime !== null && body.estimatedTime !== '' ? Math.round(Number(body.estimatedTime)) : null;
		oldValues.estimatedTime = existing.estimatedTime;
	}

	// If board changed, reset column/swimlane unless explicitly set
	if ('kanbanBoardId' in body && body.kanbanBoardId !== existing.kanbanBoardId) {
		if (!('columnId' in body)) {
			data.columnId = null;
			oldValues.columnId = existing.columnId;
		}
		if (!('swimlaneId' in body)) {
			data.swimlaneId = null;
			oldValues.swimlaneId = existing.swimlaneId;
		}
	}

	const updated = await prisma.task.update({
		where: { id },
		data
	});

	await logUpdate(locals.user!.id, 'projects', String(id), 'Task', oldValues, body);

	return json({ task: updated });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'projects', 'delete');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid task ID' }, { status: 400 });
	}

	const task = await prisma.task.findUnique({
		where: { id },
		select: { id: true, name: true, projectId: true }
	});

	if (!task) {
		return json({ error: 'Task not found' }, { status: 404 });
	}

	// Row-level access: verify user can access this task's project
	if (!(await canAccessProject(locals, task.projectId))) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	await logDelete(locals.user!.id, 'projects', String(id), 'Task', {
		name: task.name
	});

	await prisma.task.delete({
		where: { id }
	});

	return json({ success: true });
};
