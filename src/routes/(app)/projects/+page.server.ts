import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { parseListParams, buildPagination, createDeleteAction } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'projects', 'read');

	const canCreate = checkPermission(locals, 'projects', 'create');

	const { search, sortBy, sortOrder, page, limit } = parseListParams(url);
	const status = url.searchParams.get('status') || 'active';

	type WhereClause = {
		status?: string;
		OR?: Array<{
			name?: { contains: string; mode: 'insensitive' };
			description?: { contains: string; mode: 'insensitive' };
			client?: { name: { contains: string; mode: 'insensitive' } };
		}>;
	};

	let where: WhereClause = {};

	if (['planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived'].includes(status)) {
		where.status = status;
	} else {
		where.status = 'active';
	}

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: 'insensitive' } },
			{ description: { contains: search, mode: 'insensitive' } },
			{ client: { name: { contains: search, mode: 'insensitive' } } }
		];
	}

	// Build orderBy — handle nested client sort
	let orderBy: Record<string, unknown>;
	if (sortBy === 'client') {
		orderBy = { client: { name: sortOrder } };
	} else {
		orderBy = { [sortBy]: sortOrder };
	}

	const [projects, total] = await Promise.all([
		prisma.project.findMany({
			where,
			orderBy,
			skip: (page - 1) * limit,
			take: limit,
			select: {
				id: true,
				name: true,
				status: true,
				priority: true,
				startDate: true,
				endDate: true,
				createdAt: true,
				client: {
					select: {
						id: true,
						name: true
					}
				},
				projectManager: {
					select: {
						id: true,
						firstName: true,
						lastName: true
					}
				},
				_count: {
					select: {
						tasks: true,
						kanbanBoards: true,
						milestones: true,
						assignedEmployees: true
					}
				}
			}
		}),
		prisma.project.count({ where })
	]);

	return {
		projects: projects.map(project => ({
			...project,
			taskCount: project._count.tasks,
			boardCount: project._count.kanbanBoards,
			milestoneCount: project._count.milestones,
			teamCount: project._count.assignedEmployees
		})),
		pagination: buildPagination(page, limit, total),
		filters: {
			search,
			sortBy,
			sortOrder,
			status
		},
		canCreate
	};
};

export const actions: Actions = {
	delete: createDeleteAction({
		permission: ['projects', 'delete'],
		module: 'projects',
		entityType: 'Project',
		model: 'project',
		findSelect: { id: true, name: true },
		auditValues: (record) => ({ name: record.name })
	})
};
