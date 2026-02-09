import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'projects', 'read');

	const isAdmin = checkPermission(locals, '*', '*');

	const search = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '10');
	const status = url.searchParams.get('status') || 'active';
	const clientFilter = url.searchParams.get('client') || '';
	const groupByClient = url.searchParams.get('groupByClient') === 'true';

	type WhereClause = {
		project?: {
			clientId?: number;
		};
		OR?: Array<{
			name?: { contains: string; mode: 'insensitive' };
			description?: { contains: string; mode: 'insensitive' };
			project?: { name: { contains: string; mode: 'insensitive' } };
		}>;
	};

	let where: WhereClause = {};

	// Client filter
	if (clientFilter) {
		const clientId = parseInt(clientFilter);
		if (!isNaN(clientId)) {
			where.project = { ...where.project, clientId };
		}
	}

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: 'insensitive' } },
			{ description: { contains: search, mode: 'insensitive' } },
			{ project: { name: { contains: search, mode: 'insensitive' } } }
		];
	}

	// Build orderBy — handle nested sorts
	let orderBy: Record<string, unknown>;
	if (sortBy === 'project') {
		orderBy = { project: { name: sortOrder } };
	} else if (sortBy === 'client') {
		orderBy = { project: { client: { name: sortOrder } } };
	} else {
		orderBy = { [sortBy]: sortOrder };
	}

	const [boards, total] = await Promise.all([
		prisma.kanbanBoard.findMany({
			where,
			orderBy,
			skip: (page - 1) * limit,
			take: limit,
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
				_count: {
					select: {
						members: true,
						tasks: true
					}
				}
			}
		}),
		prisma.kanbanBoard.count({ where })
	]);

	// Load clients that have projects with boards (for filter dropdown)
	const clients = await prisma.client.findMany({
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

	return {
		boards: boards.map(board => ({
			id: board.id,
			name: board.name,
			description: board.description,
			createdAt: board.createdAt,
			projectId: board.project.id,
			projectName: board.project.name,
			clientId: board.project.client.id,
			clientName: board.project.client.name,
			memberCount: board._count.members,
			taskCount: board._count.tasks
		})),
		clients,
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
			status,
			client: clientFilter,
			groupByClient
		},
		isAdmin
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		await requirePermission(locals, 'projects', 'delete');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Board ID is required' });
		}

		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid board ID' });
		}

		const board = await prisma.kanbanBoard.findUnique({
			where: { id },
			select: { id: true, name: true }
		});

		if (!board) {
			return fail(404, { error: 'Board not found' });
		}

		await logDelete(locals.user!.id, 'projects', String(id), 'KanbanBoard', {
			name: board.name
		});

		await prisma.kanbanBoard.delete({
			where: { id }
		});

		return { success: true };
	}
};
