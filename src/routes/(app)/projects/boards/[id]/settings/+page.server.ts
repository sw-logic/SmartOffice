import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail, error } from '@sveltejs/kit';
import { logCreate, logUpdate, logDelete, logAction } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'projects', 'kanban');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid board ID');
	}

	const board = await prisma.kanbanBoard.findUnique({
		where: { id },
		select: {
			id: true,
			name: true,
			projectId: true,
			project: {
				select: {
					id: true,
					name: true,
					client: { select: { name: true } }
				}
			},
			columns: {
				orderBy: { order: 'asc' },
				select: {
					id: true,
					name: true,
					order: true,
					color: true,
					_count: { select: { tasks: true } }
				}
			},
			swimlanes: {
				orderBy: { order: 'asc' },
				select: {
					id: true,
					name: true,
					order: true,
					color: true,
					_count: { select: { tasks: true } }
				}
			},
			members: {
				select: {
					personId: true,
					role: true,
					assignedAt: true,
					person: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							jobTitle: true
						}
					}
				}
			}
		}
	});

	if (!board) {
		throw error(404, 'Board not found');
	}

	// Get ALL project employees (for the Manage multi-select popover)
	const allProjectEmployees = await prisma.projectEmployee.findMany({
		where: { projectId: board.projectId },
		select: {
			person: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
					jobTitle: true
				}
			}
		}
	});

	return {
		board: {
			id: board.id,
			name: board.name,
			projectId: board.projectId,
			projectName: board.project.name,
			clientName: board.project.client.name
		},
		columns: board.columns.map((c) => ({
			id: c.id,
			name: c.name,
			order: c.order,
			color: c.color,
			taskCount: c._count.tasks
		})),
		swimlanes: board.swimlanes.map((s) => ({
			id: s.id,
			name: s.name,
			order: s.order,
			color: s.color,
			taskCount: s._count.tasks
		})),
		members: board.members.map((m) => ({
			personId: m.personId,
			role: m.role,
			assignedAt: m.assignedAt,
			firstName: m.person.firstName,
			lastName: m.person.lastName,
			jobTitle: m.person.jobTitle
		})),
		allProjectEmployees: allProjectEmployees.map((e) => ({
			id: e.person.id,
			firstName: e.person.firstName,
			lastName: e.person.lastName,
			jobTitle: e.person.jobTitle
		}))
	};
};

export const actions: Actions = {
	addColumn: async ({ locals, request, params }) => {
		await requirePermission(locals, 'projects', 'kanban');

		const boardId = parseInt(params.id);
		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();
		const color = (formData.get('color') as string)?.trim() || null;

		if (!name) {
			return fail(400, { error: 'Name is required' });
		}

		const maxOrder = await prisma.kanbanColumn.aggregate({
			where: { kanbanBoardId: boardId },
			_max: { order: true }
		});

		const column = await prisma.kanbanColumn.create({
			data: {
				kanbanBoardId: boardId,
				name,
				color,
				order: (maxOrder._max.order ?? 0) + 1
			}
		});

		await logCreate(locals.user!.id, 'projects.kanban', String(column.id), 'KanbanColumn', {
			boardId,
			name,
			color
		});

		return { success: true };
	},

	updateColumn: async ({ locals, request, params }) => {
		await requirePermission(locals, 'projects', 'kanban');

		const boardId = parseInt(params.id);
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const name = (formData.get('name') as string)?.trim();
		const color = (formData.get('color') as string)?.trim() || null;

		if (!id || !name) {
			return fail(400, { error: 'ID and name are required' });
		}

		const existing = await prisma.kanbanColumn.findUnique({ where: { id } });
		if (!existing || existing.kanbanBoardId !== boardId) {
			return fail(404, { error: 'Column not found' });
		}

		await prisma.kanbanColumn.update({
			where: { id },
			data: { name, color }
		});

		await logUpdate(
			locals.user!.id,
			'projects.kanban',
			String(id),
			'KanbanColumn',
			{ name: existing.name, color: existing.color },
			{ name, color }
		);

		return { success: true };
	},

	deleteColumn: async ({ locals, request, params }) => {
		await requirePermission(locals, 'projects', 'kanban');

		const boardId = parseInt(params.id);
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);

		if (!id) {
			return fail(400, { error: 'ID is required' });
		}

		const column = await prisma.kanbanColumn.findUnique({
			where: { id },
			include: { _count: { select: { tasks: true } } }
		});

		if (!column || column.kanbanBoardId !== boardId) {
			return fail(404, { error: 'Column not found' });
		}

		if (column._count.tasks > 0) {
			return fail(400, {
				error: `Cannot delete column "${column.name}" — it has ${column._count.tasks} active task(s). Move or delete them first.`
			});
		}

		await logDelete(locals.user!.id, 'projects.kanban', String(id), 'KanbanColumn', {
			name: column.name,
			boardId
		});

		await prisma.kanbanColumn.delete({ where: { id } });

		return { success: true };
	},

	reorderColumns: async ({ locals, request, params }) => {
		await requirePermission(locals, 'projects', 'kanban');

		const boardId = parseInt(params.id);
		const formData = await request.formData();
		const ordersJson = formData.get('orders') as string;

		if (!ordersJson) {
			return fail(400, { error: 'Orders are required' });
		}

		const orders: Array<{ id: number; order: number }> = JSON.parse(ordersJson);

		// Verify all columns belong to this board
		const columns = await prisma.kanbanColumn.findMany({
			where: { kanbanBoardId: boardId, id: { in: orders.map((o) => o.id) } },
			select: { id: true }
		});
		const validIds = new Set(columns.map((c) => c.id));

		const validOrders = orders.filter((o) => validIds.has(o.id));

		await prisma.$transaction(
			validOrders.map((order) =>
				prisma.kanbanColumn.update({
					where: { id: order.id },
					data: { order: order.order }
				})
			)
		);

		await logAction({
			userId: locals.user!.id,
			action: 'updated',
			module: 'projects.kanban',
			entityId: String(boardId),
			entityType: 'KanbanColumn',
			newValues: { reordered: validOrders.map((o) => o.id), count: validOrders.length }
		});

		return { success: true };
	},

	addSwimlane: async ({ locals, request, params }) => {
		await requirePermission(locals, 'projects', 'kanban');

		const boardId = parseInt(params.id);
		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();
		const color = (formData.get('color') as string)?.trim() || null;

		if (!name) {
			return fail(400, { error: 'Name is required' });
		}

		const maxOrder = await prisma.kanbanSwimlane.aggregate({
			where: { kanbanBoardId: boardId },
			_max: { order: true }
		});

		const swimlane = await prisma.kanbanSwimlane.create({
			data: {
				kanbanBoardId: boardId,
				name,
				color,
				order: (maxOrder._max.order ?? 0) + 1
			}
		});

		await logCreate(locals.user!.id, 'projects.kanban', String(swimlane.id), 'KanbanSwimlane', {
			boardId,
			name,
			color
		});

		return { success: true };
	},

	updateSwimlane: async ({ locals, request, params }) => {
		await requirePermission(locals, 'projects', 'kanban');

		const boardId = parseInt(params.id);
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const name = (formData.get('name') as string)?.trim();
		const color = (formData.get('color') as string)?.trim() || null;

		if (!id || !name) {
			return fail(400, { error: 'ID and name are required' });
		}

		const existing = await prisma.kanbanSwimlane.findUnique({ where: { id } });
		if (!existing || existing.kanbanBoardId !== boardId) {
			return fail(404, { error: 'Swimlane not found' });
		}

		await prisma.kanbanSwimlane.update({
			where: { id },
			data: { name, color }
		});

		await logUpdate(
			locals.user!.id,
			'projects.kanban',
			String(id),
			'KanbanSwimlane',
			{ name: existing.name, color: existing.color },
			{ name, color }
		);

		return { success: true };
	},

	deleteSwimlane: async ({ locals, request, params }) => {
		await requirePermission(locals, 'projects', 'kanban');

		const boardId = parseInt(params.id);
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);

		if (!id) {
			return fail(400, { error: 'ID is required' });
		}

		const swimlane = await prisma.kanbanSwimlane.findUnique({
			where: { id },
			include: { _count: { select: { tasks: true } } }
		});

		if (!swimlane || swimlane.kanbanBoardId !== boardId) {
			return fail(404, { error: 'Swimlane not found' });
		}

		if (swimlane._count.tasks > 0) {
			return fail(400, {
				error: `Cannot delete swimlane "${swimlane.name}" — it has ${swimlane._count.tasks} active task(s). Move or delete them first.`
			});
		}

		await logDelete(locals.user!.id, 'projects.kanban', String(id), 'KanbanSwimlane', {
			name: swimlane.name,
			boardId
		});

		await prisma.kanbanSwimlane.delete({ where: { id } });

		return { success: true };
	},

	reorderSwimlanes: async ({ locals, request, params }) => {
		await requirePermission(locals, 'projects', 'kanban');

		const boardId = parseInt(params.id);
		const formData = await request.formData();
		const ordersJson = formData.get('orders') as string;

		if (!ordersJson) {
			return fail(400, { error: 'Orders are required' });
		}

		const orders: Array<{ id: number; order: number }> = JSON.parse(ordersJson);

		const swimlanes = await prisma.kanbanSwimlane.findMany({
			where: { kanbanBoardId: boardId, id: { in: orders.map((o) => o.id) } },
			select: { id: true }
		});
		const validIds = new Set(swimlanes.map((s) => s.id));

		const validOrders = orders.filter((o) => validIds.has(o.id));

		await prisma.$transaction(
			validOrders.map((order) =>
				prisma.kanbanSwimlane.update({
					where: { id: order.id },
					data: { order: order.order }
				})
			)
		);

		await logAction({
			userId: locals.user!.id,
			action: 'updated',
			module: 'projects.kanban',
			entityId: String(boardId),
			entityType: 'KanbanSwimlane',
			newValues: { reordered: validOrders.map((o) => o.id), count: validOrders.length }
		});

		return { success: true };
	},

	updateMembers: async ({ locals, request, params }) => {
		await requirePermission(locals, 'projects', 'kanban');

		const boardId = parseInt(params.id);
		const formData = await request.formData();
		const personIdsJson = formData.get('personIds') as string;

		let personIds: number[];
		try {
			personIds = JSON.parse(personIdsJson);
			if (!Array.isArray(personIds)) throw new Error();
		} catch {
			return fail(400, { error: 'Invalid person IDs' });
		}

		// Verify all persons are on the board's project
		const board = await prisma.kanbanBoard.findUnique({
			where: { id: boardId },
			select: { projectId: true }
		});

		if (!board) {
			return fail(404, { error: 'Board not found' });
		}

		const projectEmployees = await prisma.projectEmployee.findMany({
			where: { projectId: board.projectId },
			select: { personId: true }
		});
		const validIds = new Set(projectEmployees.map((pe) => pe.personId));
		const filteredIds = personIds.filter((id) => validIds.has(id));

		// Get old members for audit
		const oldMembers = await prisma.kanbanBoardMember.findMany({
			where: { kanbanBoardId: boardId },
			select: { personId: true }
		});

		// Replace members: delete all, recreate
		await prisma.$transaction([
			prisma.kanbanBoardMember.deleteMany({ where: { kanbanBoardId: boardId } }),
			...filteredIds.map((personId) =>
				prisma.kanbanBoardMember.create({
					data: { kanbanBoardId: boardId, personId, role: 'member' }
				})
			)
		]);

		await logUpdate(
			locals.user!.id,
			'projects.kanban',
			String(boardId),
			'KanbanBoard',
			{ memberIds: oldMembers.map((m) => m.personId) },
			{ memberIds: filteredIds }
		);

		return { success: true };
	},

	updateMemberRole: async ({ locals, request, params }) => {
		await requirePermission(locals, 'projects', 'kanban');

		const boardId = parseInt(params.id);
		const formData = await request.formData();
		const personId = parseInt(formData.get('personId') as string);
		const role = (formData.get('role') as string)?.trim();

		if (!personId || !role) {
			return fail(400, { error: 'Person ID and role are required' });
		}

		const existing = await prisma.kanbanBoardMember.findUnique({
			where: {
				kanbanBoardId_personId: { kanbanBoardId: boardId, personId }
			}
		});

		if (!existing) {
			return fail(404, { error: 'Member not found' });
		}

		await prisma.kanbanBoardMember.update({
			where: {
				kanbanBoardId_personId: { kanbanBoardId: boardId, personId }
			},
			data: { role }
		});

		await logUpdate(
			locals.user!.id,
			'projects.kanban',
			`${boardId}-${personId}`,
			'KanbanBoardMember',
			{ role: existing.role },
			{ role }
		);

		return { success: true };
	}
};
