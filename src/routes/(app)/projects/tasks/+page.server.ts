import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete, logAction } from '$lib/server/audit';
import { getEnumValuesBatch } from '$lib/server/enums';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'projects', 'read');

	const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;

	// URL params
	const search = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '20');
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

	// Soft delete filter
	if (status === 'deleted' && isAdmin) {
		where.deletedAt = { not: null };
	} else if (status === 'all' && isAdmin) {
		where.deletedAt = undefined as any;
	} else {
		// Default: active records
	}

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
				deletedAt: true,
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

	// Get spent time per task
	const taskIds = tasks.map(t => t.id);
	const spentTimeData = taskIds.length > 0
		? await prisma.timeRecord.groupBy({
				by: ['taskId'],
				where: { taskId: { in: taskIds }, deletedAt: null },
				_sum: { hours: true }
			})
		: [];

	const spentTimeMap = new Map(
		spentTimeData.map(r => [r.taskId, Number(r._sum.hours) || 0])
	);

	// Load filter dropdown data
	const [projects, clients, boards, employees, enums] = await Promise.all([
		prisma.project.findMany({
			select: {
				id: true,
				name: true,
				clientId: true,
				client: { select: { id: true, name: true } },
				kanbanBoards: {
					where: { deletedAt: null },
					select: {
						id: true,
						name: true,
						columns: {
							where: { deletedAt: null },
							orderBy: { order: 'asc' },
							select: { id: true, name: true }
						},
						swimlanes: {
							where: { deletedAt: null },
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
		}),
		getEnumValuesBatch([
			'task_type', 'task_category',
			'time_record_type', 'time_record_category'
		])
	]);

	// Load task_tags enum values with IDs (needed for EntityTag)
	const taskTagsEnumType = await prisma.enumType.findUnique({
		where: { code: 'task_tags' },
		include: {
			values: {
				where: { isActive: true, deletedAt: null },
				orderBy: { sortOrder: 'asc' },
				select: { id: true, value: true, label: true, color: true }
			}
		}
	});

	return {
		tasks: tasks.map(task => ({
			...task,
			estimatedTime: task.estimatedTime ? Number(task.estimatedTime) : null,
			spentTime: spentTimeMap.get(task.id) || 0,
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
		taskTypes: enums['task_type'] || [],
		taskCategories: enums['task_category'] || [],
		timeRecordTypes: enums['time_record_type'] || [],
		timeRecordCategories: enums['time_record_category'] || [],
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

		await prisma.task.update({
			where: { id },
			data: { deletedAt: new Date() }
		});

		await logDelete(locals.user!.id, 'projects', String(id), 'Task', {
			name: task.name
		});

		return { success: true };
	},

	restore: async ({ locals, request }) => {
		await requirePermission(locals, 'projects', 'update');

		const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;
		if (!isAdmin) {
			return fail(403, { error: 'Only administrators can restore deleted tasks' });
		}

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
			select: { id: true, name: true, deletedAt: true }
		});

		if (!task) {
			return fail(404, { error: 'Task not found' });
		}

		if (!task.deletedAt) {
			return fail(400, { error: 'Task is not deleted' });
		}

		await prisma.task.update({
			where: { id },
			data: { deletedAt: null }
		});

		await logAction({
			userId: locals.user!.id,
			action: 'restored',
			module: 'projects',
			entityId: String(id),
			entityType: 'Task',
			oldValues: { deletedAt: task.deletedAt },
			newValues: { deletedAt: null }
		});

		return { success: true };
	}
};
