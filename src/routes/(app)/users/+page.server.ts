import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete } from '$lib/server/audit';
import { invalidateUserValidity } from '$lib/server/user-cache';

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
						{ email: { contains: search, mode: 'insensitive' as const } }
					]
				}
			: {})
	};

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where,
			orderBy: { [sortBy]: sortOrder },
			skip: (page - 1) * limit,
			take: limit,
			select: {
				id: true,
				name: true,
				email: true,
				image: true,
				createdAt: true,
				userGroups: {
					select: {
						userGroup: {
							select: {
								id: true,
								name: true
							}
						}
					}
				}
			}
		}),
		prisma.user.count({ where })
	]);

	return {
		users: users.map(user => ({
			...user,
			groups: user.userGroups.map(ug => ug.userGroup)
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
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'User ID is required' });
		}

		// Prevent deleting yourself
		if (id === locals.user?.id) {
			return fail(400, { error: 'You cannot delete your own account' });
		}

		const user = await prisma.user.findUnique({
			where: { id },
			select: { id: true, email: true, name: true }
		});

		if (!user) {
			return fail(404, { error: 'User not found' });
		}

		// Audit log before hard delete
		await logDelete(locals.user!.id, 'users', id, 'User', {
			email: user.email,
			name: user.name
		});

		await prisma.user.delete({
			where: { id }
		});

		// Immediately evict from session validity cache so the deleted user
		// loses access on their next request instead of waiting for TTL expiry.
		invalidateUserValidity(id);

		return { success: true };
	}
};
