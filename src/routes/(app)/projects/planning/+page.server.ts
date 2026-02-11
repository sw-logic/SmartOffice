import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { startOfWeek, addDays, format } from 'date-fns';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'projects', 'read');

	const isAdmin = checkPermission(locals, '*', '*');

	// URL params
	const weekParam = url.searchParams.get('week');
	const viewMode = (url.searchParams.get('viewMode') || 'workweek') as 'workweek' | 'fullweek';
	const projectId = url.searchParams.get('projectId');
	const clientId = url.searchParams.get('clientId');
	const assigneeId = url.searchParams.get('assigneeId');
	const hideDone = url.searchParams.get('hideDone') !== 'false'; // default true
	const status = url.searchParams.get('status');

	// Determine week start (Monday)
	const weekStart = weekParam
		? startOfWeek(new Date(weekParam + 'T00:00:00'), { weekStartsOn: 1 })
		: startOfWeek(new Date(), { weekStartsOn: 1 });

	const dayCount = viewMode === 'fullweek' ? 7 : 5;
	const weekEnd = addDays(weekStart, dayCount);

	// Build shared filter conditions
	const taskFilter: Record<string, unknown> = {};

	if (projectId) {
		taskFilter.projectId = parseInt(projectId);
	}
	if (clientId) {
		taskFilter.project = { clientId: parseInt(clientId) };
	}
	if (assigneeId) {
		taskFilter.assignedToId = parseInt(assigneeId);
	}
	if (status) {
		taskFilter.status = status;
	} else if (hideDone) {
		taskFilter.isComplete = false;
	}

	const taskSelect = {
		id: true,
		name: true,
		status: true,
		priority: true,
		type: true,
		isComplete: true,
		startDate: true,
		dueDate: true,
		estimatedTime: true,
		spentTime: true,
		assignedToId: true,
		assignedTo: {
			select: { id: true, firstName: true, lastName: true, image: true }
		},
		project: {
			select: {
				id: true,
				name: true,
				client: { select: { id: true, name: true } }
			}
		}
	};

	// Run all queries in parallel
	const [scheduledTasks, unscheduledTasks, employees, projects, clients] = await Promise.all([
		// Scheduled tasks: startDate within week range
		prisma.task.findMany({
			where: {
				...taskFilter,
				startDate: {
					gte: weekStart,
					lt: weekEnd
				}
			},
			select: taskSelect,
			orderBy: { name: 'asc' }
		}),

		// Unscheduled tasks: no startDate
		prisma.task.findMany({
			where: {
				...taskFilter,
				startDate: null
			},
			select: taskSelect,
			orderBy: [{ priority: 'desc' }, { name: 'asc' }],
			take: 50
		}),

		// Active employees
		prisma.user.findMany({
			where: { employeeStatus: 'active' },
			select: { id: true, firstName: true, lastName: true, image: true },
			orderBy: { firstName: 'asc' }
		}),

		// Active projects (for filter dropdown)
		prisma.project.findMany({
			select: {
				id: true,
				name: true,
				client: { select: { id: true, name: true } }
			},
			orderBy: { name: 'asc' }
		}),

		// Active clients (for filter dropdown)
		prisma.client.findMany({
			select: { id: true, name: true },
			orderBy: { name: 'asc' }
		})
	]);

	// Load tags for all tasks
	const allTaskIds = [...scheduledTasks, ...unscheduledTasks].map(t => t.id);
	const entityTags = allTaskIds.length > 0
		? await prisma.entityTag.findMany({
			where: { entityType: 'Task', entityId: { in: allTaskIds.map(String) } },
			select: {
				entityId: true,
				enumValue: { select: { label: true, color: true } }
			}
		})
		: [];

	const tagsByTaskId = new Map<number, Array<{ label: string; color: string | null }>>();
	for (const et of entityTags) {
		const tid = parseInt(et.entityId);
		if (!tagsByTaskId.has(tid)) tagsByTaskId.set(tid, []);
		tagsByTaskId.get(tid)!.push({ label: et.enumValue.label, color: et.enumValue.color });
	}

	return {
		tasks: scheduledTasks.map(t => ({ ...t, tags: tagsByTaskId.get(t.id) || [] })),
		unscheduledTasks: unscheduledTasks.map(t => ({ ...t, tags: tagsByTaskId.get(t.id) || [] })),
		employees,
		projects,
		clients,
		filters: {
			week: format(weekStart, 'yyyy-MM-dd'),
			viewMode,
			projectId: projectId || '',
			clientId: clientId || '',
			assigneeId: assigneeId || '',
			hideDone,
			status: status || ''
		},
		isAdmin
	};
};
