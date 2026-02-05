import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete, logAction } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'settings', 'users');

	// Check if user is admin (can see deleted groups)
	const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;

	const search = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '10');
	const status = url.searchParams.get('status') || 'active';

	// Build where clause based on status filter
	let deletedAtFilter: object = {};
	if (status === 'active') {
		deletedAtFilter = { deletedAt: null };
	} else if (status === 'deleted' && isAdmin) {
		deletedAtFilter = { deletedAt: { not: null } };
	} else if (status === 'all' && isAdmin) {
		deletedAtFilter = {};
	} else {
		deletedAtFilter = { deletedAt: null };
	}

	const where = {
		...deletedAtFilter,
		...(search
			? {
					OR: [
						{ name: { contains: search, mode: 'insensitive' as const } },
						{ description: { contains: search, mode: 'insensitive' as const } }
					]
				}
			: {})
	};

	const [groups, total] = await Promise.all([
		prisma.userGroup.findMany({
			where,
			orderBy: { [sortBy]: sortOrder },
			skip: (page - 1) * limit,
			take: limit,
			select: {
				id: true,
				name: true,
				description: true,
				deletedAt: true,
				createdAt: true,
				_count: {
					select: {
						users: true,
						permissions: true
					}
				}
			}
		}),
		prisma.userGroup.count({ where })
	]);

	return {
		groups: groups.map(group => ({
			...group,
			userCount: group._count.users,
			permissionCount: group._count.permissions
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
		isAdmin
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		await requirePermission(locals, 'settings', 'users');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Group ID is required' });
		}
		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid group ID' });
		}

		const group = await prisma.userGroup.findUnique({
			where: { id },
			select: { id: true, name: true, _count: { select: { users: true } } }
		});

		if (!group) {
			return fail(404, { error: 'Group not found' });
		}

		// Prevent deleting groups with users
		if (group._count.users > 0) {
			return fail(400, { error: 'Cannot delete a group that has users assigned. Remove users first.' });
		}

		// Soft delete
		await prisma.userGroup.update({
			where: { id },
			data: { deletedAt: new Date() }
		});

		await logDelete(locals.user!.id, 'user-groups', String(id), 'UserGroup', {
			name: group.name
		});

		return { success: true };
	},

	restore: async ({ locals, request }) => {
		await requirePermission(locals, 'settings', 'users');

		// Only admins can restore
		const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;
		if (!isAdmin) {
			return fail(403, { error: 'Only administrators can restore deleted groups' });
		}

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Group ID is required' });
		}
		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid group ID' });
		}

		const group = await prisma.userGroup.findUnique({
			where: { id },
			select: { id: true, name: true, deletedAt: true }
		});

		if (!group) {
			return fail(404, { error: 'Group not found' });
		}

		if (!group.deletedAt) {
			return fail(400, { error: 'Group is not deleted' });
		}

		// Restore group
		await prisma.userGroup.update({
			where: { id },
			data: { deletedAt: null }
		});

		await logAction({
			userId: locals.user!.id,
			action: 'restored',
			module: 'user-groups',
			entityId: String(id),
			entityType: 'UserGroup',
			oldValues: { deletedAt: group.deletedAt },
			newValues: { deletedAt: null }
		});

		return { success: true };
	}
};
