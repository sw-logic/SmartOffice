import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete } from '$lib/server/audit';
import { invalidateUserValidity } from '$lib/server/user-cache';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'settings', 'users');

	const isAdmin = checkPermission(locals, '*', '*');
	const canViewSalary = checkPermission(locals, 'employees', 'salary');

	const search = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '10');
	const statusFilter = url.searchParams.get('status') || '';
	const departmentFilter = url.searchParams.get('department') || '';

	const where: Record<string, unknown> = {};

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: 'insensitive' as const } },
			{ email: { contains: search, mode: 'insensitive' as const } },
			{ firstName: { contains: search, mode: 'insensitive' as const } },
			{ lastName: { contains: search, mode: 'insensitive' as const } },
			{ jobTitle: { contains: search, mode: 'insensitive' as const } }
		];
	}

	if (statusFilter) {
		where.employeeStatus = statusFilter;
	}

	if (departmentFilter) {
		where.department = departmentFilter;
	}

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
				firstName: true,
				lastName: true,
				jobTitle: true,
				department: true,
				employeeStatus: true,
				...(canViewSalary
					? {
							salary: true,
							salary_tax: true,
							salary_bonus: true
						}
					: {}),
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
		users: users.map((user) => ({
			...user,
			groups: user.userGroups.map((ug) => ug.userGroup),
			salary: canViewSalary && 'salary' in user ? Number(user.salary) || null : null,
			salary_tax: canViewSalary && 'salary_tax' in user ? Number(user.salary_tax) || null : null,
			salary_bonus:
				canViewSalary && 'salary_bonus' in user ? Number(user.salary_bonus) || null : null
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
			status: statusFilter,
			department: departmentFilter
		},
		isAdmin,
		canViewSalary
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		await requirePermission(locals, 'settings', 'users');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'User ID is required' });
		}

		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid user ID' });
		}

		// Prevent deleting yourself
		if (id === locals.user?.id) {
			return fail(400, { error: 'You cannot delete your own account' });
		}

		const user = await prisma.user.findUnique({
			where: { id },
			select: { id: true, email: true, name: true, firstName: true, lastName: true }
		});

		if (!user) {
			return fail(404, { error: 'User not found' });
		}

		// Audit log before hard delete
		await logDelete(locals.user!.id, 'users', String(id), 'User', {
			email: user.email,
			name: user.name,
			firstName: user.firstName,
			lastName: user.lastName
		});

		await prisma.user.delete({
			where: { id }
		});

		// Immediately evict from session validity cache so the deleted user
		// loses access on their next request instead of waiting for TTL expiry.
		invalidateUserValidity(String(id));

		return { success: true };
	},

	bulkDelete: async ({ locals, request }) => {
		await requirePermission(locals, 'settings', 'users');

		const formData = await request.formData();
		const idsStr = formData.get('ids') as string;

		if (!idsStr) {
			return fail(400, { error: 'No user IDs provided' });
		}

		const ids = idsStr
			.split(',')
			.map(Number)
			.filter((id) => !isNaN(id));

		if (ids.length === 0) {
			return fail(400, { error: 'No valid user IDs provided' });
		}

		// Prevent deleting yourself
		if (ids.includes(locals.user!.id)) {
			return fail(400, { error: 'You cannot delete your own account' });
		}

		// Fetch all users to audit-log them
		const users = await prisma.user.findMany({
			where: { id: { in: ids } },
			select: { id: true, email: true, name: true, firstName: true, lastName: true }
		});

		// Audit log each before hard delete
		for (const user of users) {
			await logDelete(locals.user!.id, 'users', String(user.id), 'User', {
				email: user.email,
				name: user.name,
				firstName: user.firstName,
				lastName: user.lastName
			});
		}

		await prisma.user.deleteMany({
			where: { id: { in: ids } }
		});

		// Evict all deleted users from session validity cache
		for (const user of users) {
			invalidateUserValidity(String(user.id));
		}

		return { success: true, count: users.length };
	}
};
