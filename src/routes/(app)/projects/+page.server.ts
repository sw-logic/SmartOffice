import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete, logAction } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'projects', 'read');

	const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;
	const canCreate = locals.user ? await checkPermission(locals.user.id, 'projects', 'create') : false;

	const search = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '10');
	const status = url.searchParams.get('status') || 'active';

	type WhereClause = {
		deletedAt?: null | { not: null };
		status?: string;
		OR?: Array<{
			name?: { contains: string; mode: 'insensitive' };
			description?: { contains: string; mode: 'insensitive' };
			client?: { name: { contains: string; mode: 'insensitive' } };
		}>;
	};

	let where: WhereClause = {};

	if (status === 'deleted' && isAdmin) {
		where.deletedAt = { not: null };
	} else if (status === 'all' && isAdmin) {
		where.deletedAt = undefined as any;
	} else if (['planning', 'active', 'on_hold', 'completed', 'cancelled', 'archived'].includes(status)) {
		where.deletedAt = null;
		where.status = status;
	} else {
		where.deletedAt = null;
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
				deletedAt: true,
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
			status
		},
		isAdmin,
		canCreate
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		await requirePermission(locals, 'projects', 'delete');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Project ID is required' });
		}

		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid project ID' });
		}

		const project = await prisma.project.findUnique({
			where: { id },
			select: { id: true, name: true }
		});

		if (!project) {
			return fail(404, { error: 'Project not found' });
		}

		await prisma.project.update({
			where: { id },
			data: { deletedAt: new Date() }
		});

		await logDelete(locals.user!.id, 'projects', String(id), 'Project', {
			name: project.name
		});

		return { success: true };
	},

	restore: async ({ locals, request }) => {
		await requirePermission(locals, 'projects', 'update');

		const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;
		if (!isAdmin) {
			return fail(403, { error: 'Only administrators can restore deleted projects' });
		}

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Project ID is required' });
		}

		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid project ID' });
		}

		const project = await prisma.project.findUnique({
			where: { id },
			select: { id: true, name: true, deletedAt: true }
		});

		if (!project) {
			return fail(404, { error: 'Project not found' });
		}

		if (!project.deletedAt) {
			return fail(400, { error: 'Project is not deleted' });
		}

		await prisma.project.update({
			where: { id },
			data: { deletedAt: null }
		});

		await logAction({
			userId: locals.user!.id,
			action: 'restored',
			module: 'projects',
			entityId: String(id),
			entityType: 'Project',
			oldValues: { deletedAt: project.deletedAt },
			newValues: { deletedAt: null }
		});

		return { success: true };
	}
};
