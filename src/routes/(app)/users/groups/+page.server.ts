import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'settings', 'users');

	const isAdmin = checkPermission(locals, '*', '*');

	const search = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '10');

	const where = {
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
			sortOrder
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

		// Audit log before hard delete
		await logDelete(locals.user!.id, 'user-groups', String(id), 'UserGroup', {
			name: group.name
		});

		await prisma.userGroup.delete({
			where: { id }
		});

		return { success: true };
	}
};
