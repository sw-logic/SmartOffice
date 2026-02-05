import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { error, fail } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'employees', 'read');

	// Check if user can view salary info
	const canViewSalary = locals.user
		? await checkPermission(locals.user.id, 'employees', 'salary')
		: false;

	// Check if user can manage permissions
	const canManagePermissions = locals.user
		? await checkPermission(locals.user.id, 'employees', 'permissions')
		: false;

	// Check if user is admin (can view deleted employees)
	const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;

	// Parse employee ID
	const employeeId = parseInt(params.id);
	if (isNaN(employeeId)) {
		error(400, 'Invalid employee ID');
	}

	// Salary select fields based on permission
	const salarySelect = canViewSalary
		? {
				salary: true,
				salary_tax: true,
				salary_bonus: true
			}
		: {};

	const employee = await prisma.person.findFirst({
		where: {
			id: employeeId,
			personType: 'company_employee'
		},
		select: {
			id: true,
			firstName: true,
			lastName: true,
			email: true,
			phone: true,
			mobile: true,
			dateOfBirth: true,
			street: true,
			city: true,
			postalCode: true,
			country: true,
			hireDate: true,
			employmentType: true,
			department: true,
			jobTitle: true,
			employeeStatus: true,
			emergencyContact: true,
			notes: true,
			deletedAt: true,
			createdAt: true,
			updatedAt: true,
			...salarySelect,
			user: {
				select: {
					id: true,
					name: true,
					email: true,
					userGroups: {
						select: {
							userGroup: {
								select: {
									id: true,
									name: true,
									description: true
								}
							}
						}
					}
				}
			},
			managedProjects: {
				where: { deletedAt: null },
				select: {
					id: true,
					name: true,
					status: true,
					client: {
						select: {
							id: true,
							name: true
						}
					}
				},
				orderBy: { createdAt: 'desc' },
				take: 10
			},
			assignedProjects: {
				where: {
					project: { deletedAt: null }
				},
				select: {
					role: true,
					assignedAt: true,
					project: {
						select: {
							id: true,
							name: true,
							status: true,
							client: {
								select: {
									id: true,
									name: true
								}
							}
						}
					}
				},
				orderBy: { assignedAt: 'desc' },
				take: 10
			}
		}
	});

	if (!employee) {
		error(404, 'Employee not found');
	}

	// If employee is deleted and user is not admin, deny access
	if (employee.deletedAt && !isAdmin) {
		error(403, 'Access denied');
	}

	// Get all user groups for assignment (if user can manage permissions)
	let allUserGroups: { id: number; name: string; description: string | null }[] = [];
	if (canManagePermissions && employee.user) {
		allUserGroups = await prisma.userGroup.findMany({
			where: { deletedAt: null },
			select: {
				id: true,
				name: true,
				description: true
			},
			orderBy: { name: 'asc' }
		});
	}

	// Convert Decimal fields to numbers for serialization
	const serializedEmployee = {
		...employee,
		salary: employee.salary ? Number(employee.salary) : null,
		salary_tax: employee.salary_tax ? Number(employee.salary_tax) : null,
		salary_bonus: employee.salary_bonus ? Number(employee.salary_bonus) : null,
		isDeleted: employee.deletedAt !== null
	};

	return {
		employee: serializedEmployee,
		isAdmin,
		canViewSalary,
		canManagePermissions,
		allUserGroups
	};
};

export const actions: Actions = {
	assignGroup: async ({ locals, request, params }) => {
		await requirePermission(locals, 'employees', 'permissions');

		// Parse employee ID
		const employeeId = parseInt(params.id);
		if (isNaN(employeeId)) {
			return fail(400, { error: 'Invalid employee ID' });
		}

		const formData = await request.formData();
		const groupIdStr = formData.get('groupId') as string;

		if (!groupIdStr) {
			return fail(400, { error: 'User group is required' });
		}
		const groupId = parseInt(groupIdStr);
		if (isNaN(groupId)) {
			return fail(400, { error: 'Invalid group ID' });
		}

		// Get the employee and verify they have a user account
		const employee = await prisma.person.findFirst({
			where: {
				id: employeeId,
				personType: 'company_employee'
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
				userId: true
			}
		});

		if (!employee) {
			return fail(404, { error: 'Employee not found' });
		}

		if (!employee.userId) {
			return fail(400, { error: 'Employee does not have a system account' });
		}

		// Check if already assigned
		const existing = await prisma.userGroupUser.findUnique({
			where: {
				userId_userGroupId: {
					userId: employee.userId,
					userGroupId: groupId
				}
			}
		});

		if (existing) {
			return fail(400, { error: 'User is already in this group' });
		}

		// Get group name for audit
		const group = await prisma.userGroup.findUnique({
			where: { id: groupId },
			select: { name: true }
		});

		// Assign to group
		await prisma.userGroupUser.create({
			data: {
				userId: employee.userId,
				userGroupId: groupId
			}
		});

		await logUpdate(
			locals.user!.id,
			'employees',
			String(employeeId),
			'Person',
			{},
			{
				action: 'assigned_to_group',
				groupId,
				groupName: group?.name
			}
		);

		return { success: true };
	},

	removeGroup: async ({ locals, request, params }) => {
		await requirePermission(locals, 'employees', 'permissions');

		// Parse employee ID
		const employeeId = parseInt(params.id);
		if (isNaN(employeeId)) {
			return fail(400, { error: 'Invalid employee ID' });
		}

		const formData = await request.formData();
		const groupIdStr = formData.get('groupId') as string;

		if (!groupIdStr) {
			return fail(400, { error: 'User group is required' });
		}
		const groupId = parseInt(groupIdStr);
		if (isNaN(groupId)) {
			return fail(400, { error: 'Invalid group ID' });
		}

		// Get the employee and verify they have a user account
		const employee = await prisma.person.findFirst({
			where: {
				id: employeeId,
				personType: 'company_employee'
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
				userId: true
			}
		});

		if (!employee) {
			return fail(404, { error: 'Employee not found' });
		}

		if (!employee.userId) {
			return fail(400, { error: 'Employee does not have a system account' });
		}

		// Get group name for audit
		const group = await prisma.userGroup.findUnique({
			where: { id: groupId },
			select: { name: true }
		});

		// Remove from group
		await prisma.userGroupUser.delete({
			where: {
				userId_userGroupId: {
					userId: employee.userId,
					userGroupId: groupId
				}
			}
		});

		await logUpdate(
			locals.user!.id,
			'employees',
			String(employeeId),
			'Person',
			{
				action: 'removed_from_group',
				groupId,
				groupName: group?.name
			},
			{}
		);

		return { success: true };
	}
};
