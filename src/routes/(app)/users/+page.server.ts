import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { parseListParams, buildPagination, createDeleteAction, createBulkDeleteAction } from '$lib/server/crud-helpers';
import { invalidateUserValidity } from '$lib/server/user-cache';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'settings', 'users');

	const isAdmin = checkPermission(locals, '*', '*');
	const canViewSalary = checkPermission(locals, 'employees', 'salary');

	const { search, sortBy, sortOrder, page, limit } = parseListParams(url);
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
		pagination: buildPagination(page, limit, total),
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

const userDeleteFindSelect = { id: true, email: true, name: true, firstName: true, lastName: true };
const userAuditValues = (record: any) => ({
	email: record.email,
	name: record.name,
	firstName: record.firstName,
	lastName: record.lastName
});
const preventSelfDelete = (record: any, locals: any) => {
	if (record.id === locals.user?.id) {
		return fail(400, { error: 'You cannot delete your own account' });
	}
	return null;
};
const invalidateDeletedUser = (record: any) => {
	invalidateUserValidity(String(record.id));
};

export const actions: Actions = {
	delete: createDeleteAction({
		permission: ['settings', 'users'],
		module: 'users',
		entityType: 'User',
		model: 'user',
		findSelect: userDeleteFindSelect,
		auditValues: userAuditValues,
		validate: preventSelfDelete,
		afterDelete: invalidateDeletedUser
	}),

	bulkDelete: createBulkDeleteAction({
		permission: ['settings', 'users'],
		module: 'users',
		entityType: 'User',
		model: 'user',
		findSelect: userDeleteFindSelect,
		auditValues: userAuditValues,
		validate: (records, locals) => {
			if (records.some((r: any) => r.id === locals.user?.id)) {
				return fail(400, { error: 'You cannot delete your own account' });
			}
			return null;
		},
		afterDelete: (records) => {
			for (const record of records) {
				invalidateUserValidity(String(record.id));
			}
		}
	})
};
