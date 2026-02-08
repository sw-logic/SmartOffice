import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete, logAction } from '$lib/server/audit';
import { invalidateUserValidity } from '$lib/server/user-cache';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'settings', 'users');

	// Check if user is admin (can see deleted users)
	const isAdmin = checkPermission(locals, '*', '*');

	const search = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '10');
	const status = url.searchParams.get('status') || 'active'; // 'all', 'active', 'deleted'

	// Build where clause based on status filter
	let deletedAtFilter: { deletedAt: null } | { deletedAt: { not: null } } | object = {};
	if (status === 'active') {
		deletedAtFilter = { deletedAt: null };
	} else if (status === 'deleted' && isAdmin) {
		deletedAtFilter = { deletedAt: { not: null } };
	} else if (status === 'all' && isAdmin) {
		// Show all records including deleted — explicitly mark deletedAt as handled
		// so the soft-delete extension doesn't auto-filter
		deletedAtFilter = { deletedAt: undefined } as any;
	} else {
		// Non-admins can only see active users
		deletedAtFilter = { deletedAt: null };
	}

	const where = {
		...deletedAtFilter,
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
				deletedAt: true,
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

		// Soft delete
		await prisma.user.update({
			where: { id },
			data: { deletedAt: new Date() }
		});

		// Immediately evict from session validity cache so the deleted user
		// loses access on their next request instead of waiting for TTL expiry.
		invalidateUserValidity(id);

		await logDelete(locals.user!.id, 'users', id, 'User', {
			email: user.email,
			name: user.name
		});

		return { success: true };
	},

	restore: async ({ locals, request }) => {
		await requirePermission(locals, 'settings', 'users');

		// Only admins can restore users
		const isAdmin = checkPermission(locals, '*', '*');
		if (!isAdmin) {
			return fail(403, { error: 'Only administrators can restore deleted users' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'User ID is required' });
		}

		const user = await prisma.user.findUnique({
			where: { id },
			select: { id: true, email: true, name: true, deletedAt: true }
		});

		if (!user) {
			return fail(404, { error: 'User not found' });
		}

		if (!user.deletedAt) {
			return fail(400, { error: 'User is not deleted' });
		}

		// Restore user
		await prisma.user.update({
			where: { id },
			data: { deletedAt: null }
		});

		// Evict stale "invalid" cache entry so the restored user can log in immediately.
		invalidateUserValidity(id);

		await logAction({
			userId: locals.user!.id,
			action: 'restored',
			module: 'users',
			entityId: id,
			entityType: 'User',
			oldValues: { deletedAt: user.deletedAt },
			newValues: { deletedAt: null }
		});

		return { success: true };
	}
};
