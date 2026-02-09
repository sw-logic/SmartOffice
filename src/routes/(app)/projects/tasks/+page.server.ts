import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'projects', 'read');

	const isAdmin = checkPermission(locals, '*', '*');

	// URL params
	const search = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '25');
	const status = url.searchParams.get('status') || 'active';

	// Group & filter params
	const groupBy = url.searchParams.get('groupBy') || '';
	const projectId = url.searchParams.get('projectId');
	const clientId = url.searchParams.get('clientId');
	const boardId = url.searchParams.get('boardId');
	const assigneeId = url.searchParams.get('assigneeId');
	const taskStatus = url.searchParams.get('taskStatus');
	const taskType = url.searchParams.get('taskType');
	const taskCategory = url.searchParams.get('taskCategory');
	const taskPriority = url.searchParams.get('taskPriority');

	// Build where clause
	type WhereClause = Record<string, any>;
	let where: WhereClause = {};

	// Search
	if (search) {
		where.OR = [
			{ name: { contains: search, mode: 'insensitive' } }
		];
	}

	// Filters
	if (projectId) {
		where.projectId = parseInt(projectId);
	}
	if (clientId) {
		where.project = { ...where.project, clientId: parseInt(clientId) };
	}
	if (boardId) {
		where.kanbanBoardId = parseInt(boardId);
	}
	if (assigneeId) {
		where.assignedToId = parseInt(assigneeId);
	}
	if (taskStatus) {
		where.status = taskStatus;
	}
	if (taskType) {
		where.type = taskType;
	}
	if (taskCategory) {
		where.category = taskCategory;
	}
	if (taskPriority) {
		where.priority = taskPriority;
	}

	// Helper to build an orderBy clause for a given field
	function buildSortClause(field: string, order: 'asc' | 'desc'): Record<string, unknown> {
		switch (field) {
			case 'project': return { project: { name: order } };
			case 'client': return { project: { client: { name: order } } };
			case 'assignee': return { assignedTo: { firstName: order } };
			case 'stage': return { status: order };
			default: return { [field]: order };
		}
	}

	// Build orderBy: group field first (if grouping), then user's chosen sort
	const orderByList: Record<string, unknown>[] = [];
	if (groupBy) {
		orderByList.push(buildSortClause(groupBy, 'asc'));
	}
	orderByList.push(buildSortClause(sortBy, sortOrder));
	const orderBy = orderByList.length === 1 ? orderByList[0] : orderByList;

	// Fetch tasks and count in parallel
	const [tasks, total] = await Promise.all([
		prisma.task.findMany({
			where,
			orderBy,
			skip: (page - 1) * limit,
			take: limit,
			select: {
				id: true,
				name: true,
				status: true,
				priority: true,
				type: true,
				category: true,
				dueDate: true,
				estimatedTime: true,
				spentTime: true,
				createdAt: true,
				project: {
					select: {
						id: true,
						name: true,
						client: {
							select: { id: true, name: true }
						}
					}
				},
				kanbanBoard: {
					select: { id: true, name: true }
				},
				assignedTo: {
					select: { id: true, firstName: true, lastName: true }
				},
				_count: {
					select: { timeRecords: true }
				}
			}
		}),
		prisma.task.count({ where })
	]);

	// Load filter dropdown data
	const [projects, clients, boards, employees] = await Promise.all([
		prisma.project.findMany({
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
			},
			orderBy: { name: 'asc' }
		}),
		prisma.client.findMany({
			select: { id: true, name: true },
			orderBy: { name: 'asc' }
		}),
		prisma.kanbanBoard.findMany({
			select: { id: true, name: true, projectId: true },
			orderBy: { name: 'asc' }
		}),
		prisma.person.findMany({
			where: { personType: 'company_employee', employeeStatus: 'active' },
			select: { id: true, firstName: true, lastName: true },
			orderBy: { firstName: 'asc' }
		})
	]);

	// Load task_tags enum values with IDs (needed for EntityTag)
	const taskTagsEnumType = await prisma.enumType.findUnique({
		where: { code: 'task_tags' },
		include: {
			values: {
				where: { isActive: true },
				orderBy: { sortOrder: 'asc' },
				select: { id: true, value: true, label: true, color: true }
			}
		}
	});

	return {
		tasks: tasks.map(task => ({
			...task,
			timeRecordCount: task._count.timeRecords
		})),
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		},
		filters: {
			search,
			sortBy,
			sortOrder,
			groupBy,
			status,
			projectId: projectId || '',
			clientId: clientId || '',
			boardId: boardId || '',
			assigneeId: assigneeId || '',
			taskStatus: taskStatus || '',
			taskType: taskType || '',
			taskCategory: taskCategory || '',
			taskPriority: taskPriority || ''
		},
		isAdmin,
		// Dropdown data
		projects,
		clients,
		boards,
		employees,
		availableTags: taskTagsEnumType?.values || [],
		taskStatuses: [
			{ value: 'backlog', label: 'Backlog' },
			{ value: 'todo', label: 'To Do' },
			{ value: 'in_progress', label: 'In Progress' },
			{ value: 'review', label: 'Review' },
			{ value: 'done', label: 'Done' }
		],
		taskPriorities: [
			{ value: 'low', label: 'Low' },
			{ value: 'medium', label: 'Medium' },
			{ value: 'high', label: 'High' },
			{ value: 'urgent', label: 'Urgent' }
		]
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		await requirePermission(locals, 'projects', 'delete');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Task ID is required' });
		}

		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid task ID' });
		}

		const task = await prisma.task.findUnique({
			where: { id },
			select: { id: true, name: true }
		});

		if (!task) {
			return fail(404, { error: 'Task not found' });
		}

		await logDelete(locals.user!.id, 'projects', String(id), 'Task', {
			name: task.name
		});

		await prisma.task.delete({
			where: { id }
		});

		return { success: true };
	},

	bulkDelete: async ({ locals, request }) => {
		await requirePermission(locals, 'projects', 'delete');

		const formData = await request.formData();
		const idsStr = formData.get('ids') as string;

		if (!idsStr) {
			return fail(400, { error: 'Task IDs are required' });
		}

		const ids = idsStr.split(',').map(Number).filter(id => !isNaN(id));
		if (ids.length === 0) {
			return fail(400, { error: 'No valid task IDs provided' });
		}

		const tasks = await prisma.task.findMany({
			where: {
				id: { in: ids }
			},
			select: { id: true, name: true }
		});

		if (tasks.length === 0) {
			return fail(404, { error: 'No tasks found' });
		}

		for (const task of tasks) {
			await logDelete(locals.user!.id, 'projects', String(task.id), 'Task', {
				name: task.name
			});
		}

		await prisma.task.deleteMany({
			where: { id: { in: tasks.map(t => t.id) } }
		});

		return { success: true, count: tasks.length };
	}
};
