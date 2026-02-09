import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { error, fail } from '@sveltejs/kit';
import { logAction } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'projects', 'read');

	const isAdmin = checkPermission(locals, '*', '*');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid board ID');
	}

	const board = await prisma.kanbanBoard.findUnique({
		where: { id },
		select: {
			id: true,
			name: true,
			description: true,
			createdAt: true,
			project: {
				select: {
					id: true,
					name: true,
					client: {
						select: {
							id: true,
							name: true
						}
					}
				}
			},
			columns: {
				orderBy: { order: 'asc' },
				select: {
					id: true,
					name: true,
					order: true,
					color: true
				}
			},
			swimlanes: {
				orderBy: { order: 'asc' },
				select: {
					id: true,
					name: true,
					order: true,
					color: true
				}
			},
			tasks: {
				orderBy: { order: 'asc' },
				select: {
					id: true,
					name: true,
					status: true,
					priority: true,
					type: true,
					columnId: true,
					swimlaneId: true,
					order: true,
					dueDate: true,
					estimatedTime: true,
					spentTime: true,
					assignedTo: {
						select: {
							id: true,
							firstName: true,
							lastName: true
						}
					}
				}
			},
			_count: {
				select: {
					members: true,
					tasks: true
				}
			}
		}
	});

	if (!board) {
		throw error(404, 'Board not found');
	}

	// Load all clients that have projects with boards (for nav dropdown)
	const allClients = await prisma.client.findMany({
		where: {
			projects: {
				some: {
					kanbanBoards: {
						some: {}
					}
				}
			}
		},
		select: {
			id: true,
			name: true
		},
		orderBy: { name: 'asc' }
	});

	// Load all boards for navigation
	const allBoards = await prisma.kanbanBoard.findMany({
		select: {
			id: true,
			name: true,
			project: {
				select: {
					id: true,
					name: true,
					clientId: true,
					client: {
						select: {
							name: true
						}
					}
				}
			}
		},
		orderBy: { name: 'asc' }
	});

	return {
		board: {
			id: board.id,
			name: board.name,
			description: board.description,
			createdAt: board.createdAt,
			projectId: board.project.id,
			projectName: board.project.name,
			clientId: board.project.client.id,
			clientName: board.project.client.name,
			columns: board.columns,
			swimlanes: board.swimlanes,
			tasks: board.tasks,
			memberCount: board._count.members,
			taskCount: board._count.tasks
		},
		allClients,
		allBoards: allBoards.map(b => ({
			id: b.id,
			name: b.name,
			projectId: b.project.id,
			projectName: b.project.name,
			clientId: b.project.clientId,
			clientName: b.project.client.name
		})),
		isAdmin
	};
};

export const actions: Actions = {
	moveTask: async ({ locals, request }) => {
		await requirePermission(locals, 'projects', 'update');

		const formData = await request.formData();
		const taskId = parseInt(formData.get('taskId') as string);
		const columnId = parseInt(formData.get('columnId') as string);
		const swimlaneId = parseInt(formData.get('swimlaneId') as string);
		const order = parseInt(formData.get('order') as string);

		if (isNaN(taskId) || isNaN(columnId) || isNaN(swimlaneId) || isNaN(order)) {
			return fail(400, { error: 'Invalid parameters' });
		}

		const task = await prisma.task.findUnique({
			where: { id: taskId },
			select: { id: true, columnId: true, swimlaneId: true, order: true }
		});

		if (!task) {
			return fail(404, { error: 'Task not found' });
		}

		await prisma.task.update({
			where: { id: taskId },
			data: { columnId, swimlaneId, order }
		});

		await logAction({
			userId: locals.user!.id,
			action: 'updated',
			module: 'projects',
			entityId: String(taskId),
			entityType: 'Task',
			oldValues: { columnId: task.columnId, swimlaneId: task.swimlaneId, order: task.order },
			newValues: { columnId, swimlaneId, order }
		});

		return { success: true };
	},

	reorderTasks: async ({ locals, request }) => {
		await requirePermission(locals, 'projects', 'update');

		const formData = await request.formData();
		const updatesStr = formData.get('updates') as string;

		if (!updatesStr) {
			return fail(400, { error: 'Updates are required' });
		}

		let updates: Array<{ id: number; columnId: number; swimlaneId: number; order: number }>;
		try {
			updates = JSON.parse(updatesStr);
		} catch {
			return fail(400, { error: 'Invalid updates format' });
		}

		// Batch update all tasks
		await Promise.all(
			updates.map(u =>
				prisma.task.update({
					where: { id: u.id },
					data: { columnId: u.columnId, swimlaneId: u.swimlaneId, order: u.order }
				})
			)
		);

		await logAction({
			userId: locals.user!.id,
			action: 'updated',
			module: 'projects',
			entityType: 'Task',
			newValues: { reordered: updates.map(u => u.id), count: updates.length }
		});

		return { success: true };
	}
};
