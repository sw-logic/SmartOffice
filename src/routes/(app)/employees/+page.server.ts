import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete, logUpdate } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'employees', 'read');

	// Check if user can view salary info
	const canViewSalary = locals.user
		? await checkPermission(locals.user.id, 'employees', 'salary')
		: false;

	// Check if current user is admin (can view deleted employees)
	const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;

	// Get query parameters
	const search = url.searchParams.get('search') || '';
	const status = url.searchParams.get('status') || 'active';
	const department = url.searchParams.get('department') || '';
	const employmentType = url.searchParams.get('employmentType') || '';
	const sortBy = url.searchParams.get('sortBy') || 'lastName';
	const sortOrder = url.searchParams.get('sortOrder') || 'asc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = 20;

	// Build where clause
	const where: any = {
		personType: 'company_employee'
	};

	// Handle deleted filter (admin only)
	if (status === 'deleted' && isAdmin) {
		where.deletedAt = { not: null };
	} else if (status && status !== 'all') {
		where.deletedAt = null;
		where.employeeStatus = status;
	} else if (isAdmin) {
		// Admin viewing all records — explicitly mark deletedAt as handled
		// so the soft-delete extension doesn't auto-filter
		where.deletedAt = undefined;
	} else {
		where.deletedAt = null;
	}

	// Search filter
	if (search) {
		where.OR = [
			{ firstName: { contains: search, mode: 'insensitive' } },
			{ lastName: { contains: search, mode: 'insensitive' } },
			{ email: { contains: search, mode: 'insensitive' } },
			{ jobTitle: { contains: search, mode: 'insensitive' } },
			{ department: { contains: search, mode: 'insensitive' } }
		];
	}

	// Department filter
	if (department) {
		where.department = department;
	}

	// Employment type filter
	if (employmentType) {
		where.employmentType = employmentType;
	}

	// Build orderBy
	const orderBy: any = {};
	if (sortBy === 'name') {
		orderBy.lastName = sortOrder;
	} else {
		orderBy[sortBy] = sortOrder;
	}

	// Get total count
	const totalCount = await prisma.person.count({ where });

	// Salary select fields based on permission
	const salarySelect = canViewSalary
		? {
				salary: true,
				salary_tax: true,
				salary_bonus: true
			}
		: {};

	// Get employees
	const employees = await prisma.person.findMany({
		where,
		select: {
			id: true,
			firstName: true,
			lastName: true,
			email: true,
			phone: true,
			mobile: true,
			jobTitle: true,
			department: true,
			employmentType: true,
			employeeStatus: true,
			hireDate: true,
			deletedAt: true,
			user: {
				select: {
					id: true,
					name: true,
					email: true
				}
			},
			_count: {
				select: {
					assignedProjects: true,
					managedProjects: true
				}
			},
			...salarySelect
		},
		orderBy,
		skip: (page - 1) * pageSize,
		take: pageSize
	});

	// Get distinct departments for filter
	const departmentsRaw = await prisma.person.findMany({
		where: {
			personType: 'company_employee',
			department: { not: null },
			deletedAt: null
		},
		select: { department: true },
		distinct: ['department']
	});
	const departments = departmentsRaw
		.map((d) => d.department)
		.filter((d): d is string => d !== null)
		.sort();

	// Convert Decimal fields to numbers for serialization
	const serializedEmployees = employees.map(emp => ({
		...emp,
		salary: emp.salary ? Number(emp.salary) : null,
		salary_tax: emp.salary_tax ? Number(emp.salary_tax) : null,
		salary_bonus: emp.salary_bonus ? Number(emp.salary_bonus) : null
	}));

	return {
		employees: serializedEmployees,
		departments,
		totalCount,
		page,
		pageSize,
		totalPages: Math.ceil(totalCount / pageSize),
		filters: {
			search,
			status,
			department,
			employmentType,
			sortBy,
			sortOrder
		},
		isAdmin,
		canViewSalary
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		await requirePermission(locals, 'employees', 'delete');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Employee ID is required' });
		}
		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid employee ID' });
		}

		const employee = await prisma.person.findFirst({
			where: {
				id,
				personType: 'company_employee',
				deletedAt: null
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
				email: true,
				jobTitle: true
			}
		});

		if (!employee) {
			return fail(404, { error: 'Employee not found' });
		}

		// Soft delete
		await prisma.person.update({
			where: { id },
			data: { deletedAt: new Date() }
		});

		await logDelete(locals.user!.id, 'employees', String(id), 'Person', {
			firstName: employee.firstName,
			lastName: employee.lastName,
			email: employee.email,
			jobTitle: employee.jobTitle
		});

		return { success: true };
	},

	restore: async ({ locals, request }) => {
		await requirePermission(locals, 'employees', 'update');

		// Only admins can restore
		const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;
		if (!isAdmin) {
			return fail(403, { error: 'Only administrators can restore deleted employees' });
		}

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Employee ID is required' });
		}
		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid employee ID' });
		}

		const employee = await prisma.person.findFirst({
			where: {
				id,
				personType: 'company_employee',
				deletedAt: { not: null }
			}
		});

		if (!employee) {
			return fail(404, { error: 'Deleted employee not found' });
		}

		await prisma.person.update({
			where: { id },
			data: { deletedAt: null }
		});

		await logUpdate(
			locals.user!.id,
			'employees',
			String(id),
			'Person',
			{ deletedAt: employee.deletedAt },
			{ deletedAt: null }
		);

		return { success: true };
	}
};
