import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'employees', 'read');

	// Check if user can view salary info
	const canViewSalary = checkPermission(locals, 'employees', 'salary');

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

	// Employee status filter
	if (status && status !== 'all') {
		where.employeeStatus = status;
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
			department: { not: null }
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
		canViewSalary
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		await requirePermission(locals, 'employees', 'delete');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;
		const deactivateUser = formData.get('deactivateUser') === 'true';

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
				personType: 'company_employee'
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
				email: true,
				jobTitle: true,
				userId: true
			}
		});

		if (!employee) {
			return fail(404, { error: 'Employee not found' });
		}

		// Log BEFORE hard delete (record won't exist after)
		await logDelete(locals.user!.id, 'employees', String(id), 'Person', {
			firstName: employee.firstName,
			lastName: employee.lastName,
			email: employee.email,
			jobTitle: employee.jobTitle
		});

		// Optionally delete the linked user account
		if (deactivateUser && employee.userId) {
			await logDelete(locals.user!.id, 'users', employee.userId, 'User', {
				reason: 'Deleted with employee deletion',
				employeeId: id
			});

			await prisma.user.delete({
				where: { id: employee.userId }
			});
		}

		// Hard delete the employee
		await prisma.person.delete({
			where: { id }
		});

		return { success: true };
	},

	bulkDelete: async ({ locals, request }) => {
		await requirePermission(locals, 'employees', 'delete');

		const formData = await request.formData();
		const idsStr = formData.get('ids') as string;
		const deactivateUsers = formData.get('deactivateUsers') === 'true';

		if (!idsStr) {
			return fail(400, { error: 'Employee IDs are required' });
		}

		const ids = idsStr.split(',').map(Number).filter(id => !isNaN(id));
		if (ids.length === 0) {
			return fail(400, { error: 'No valid employee IDs provided' });
		}

		const employees = await prisma.person.findMany({
			where: {
				id: { in: ids },
				personType: 'company_employee'
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
				email: true,
				jobTitle: true,
				userId: true
			}
		});

		if (employees.length === 0) {
			return fail(404, { error: 'No employees found' });
		}

		// Log each deletion BEFORE hard delete (records won't exist after)
		for (const employee of employees) {
			await logDelete(locals.user!.id, 'employees', String(employee.id), 'Person', {
				firstName: employee.firstName,
				lastName: employee.lastName,
				email: employee.email,
				jobTitle: employee.jobTitle
			});
		}

		// Optionally delete linked user accounts
		if (deactivateUsers) {
			const userIds = employees.map(e => e.userId).filter((id): id is string => id !== null);
			if (userIds.length > 0) {
				for (const employee of employees.filter(e => e.userId)) {
					await logDelete(locals.user!.id, 'users', employee.userId!, 'User', {
						reason: 'Deleted with bulk employee deletion',
						employeeId: employee.id
					});
				}

				await prisma.user.deleteMany({
					where: { id: { in: userIds } }
				});
			}
		}

		// Hard delete all employees
		await prisma.person.deleteMany({
			where: { id: { in: employees.map(e => e.id) } }
		});

		return { success: true, count: employees.length };
	}
};
