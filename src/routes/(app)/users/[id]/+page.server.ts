import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { error, fail, redirect } from '@sveltejs/kit';
import { logDelete } from '$lib/server/audit';
import { invalidateUserValidity } from '$lib/server/user-cache';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'settings', 'users');

	const userId = parseInt(params.id);
	if (isNaN(userId)) {
		error(400, 'Invalid user ID');
	}

	const canViewSalary = checkPermission(locals, 'employees', 'salary');

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			email: true,
			image: true,
			firstName: true,
			lastName: true,
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
			salary: true,
			salary_tax: true,
			salary_bonus: true,
			createdAt: true,
			updatedAt: true,
			company: {
				select: { id: true, name: true }
			},
			userGroups: {
				select: {
					userGroup: {
						select: { id: true, name: true }
					}
				}
			},
			managedProjects: {
				orderBy: { createdAt: 'desc' },
				take: 5,
				select: {
					id: true,
					name: true,
					status: true
				}
			},
			assignedProjects: {
				take: 10,
				select: {
					project: {
						select: {
							id: true,
							name: true,
							status: true
						}
					},
					role: true
				}
			},
			assignedTasks: {
				where: { status: { notIn: ['done'] } },
				orderBy: { createdAt: 'desc' },
				take: 10,
				select: {
					id: true,
					name: true,
					status: true,
					priority: true,
					dueDate: true,
					project: {
						select: { id: true, name: true }
					}
				}
			},
			_count: {
				select: {
					assignedProjects: true,
					assignedTasks: true,
					managedProjects: true,
					performedTimeRecords: true
				}
			}
		}
	});

	if (!user) {
		error(404, 'User not found');
	}

	return {
		user: {
			...user,
			groups: user.userGroups.map((ug) => ug.userGroup),
			salary: canViewSalary ? Number(user.salary) || null : null,
			salary_tax: canViewSalary ? Number(user.salary_tax) || null : null,
			salary_bonus: canViewSalary ? Number(user.salary_bonus) || null : null,
			assignedProjects: user.assignedProjects.map((ap) => ({
				...ap.project,
				role: ap.role
			}))
		},
		canViewSalary,
		isSelf: locals.user?.id === userId
	};
};

export const actions: Actions = {
	delete: async ({ locals, params }) => {
		await requirePermission(locals, 'settings', 'users');

		const userId = parseInt(params.id);
		if (isNaN(userId)) {
			return fail(400, { error: 'Invalid user ID' });
		}

		// Prevent deleting yourself
		if (userId === locals.user?.id) {
			return fail(400, { error: 'You cannot delete your own account' });
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, email: true, name: true, firstName: true, lastName: true }
		});

		if (!user) {
			return fail(404, { error: 'User not found' });
		}

		await logDelete(locals.user!.id, 'users', String(userId), 'User', {
			email: user.email,
			name: user.name,
			firstName: user.firstName,
			lastName: user.lastName
		});

		await prisma.user.delete({
			where: { id: userId }
		});

		invalidateUserValidity(String(userId));

		redirect(303, '/users');
	}
};
