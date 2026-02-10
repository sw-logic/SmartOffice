import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { logCreate, logUpdate, logDelete } from '$lib/server/audit';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'projects', 'read');

	const projectId = parseInt(params.id);
	if (isNaN(projectId)) {
		error(400, 'Invalid project ID');
	}

	const isAdmin = checkPermission(locals, '*', '*');

	// Budget visible to admin or accountant
	const isAccountant = checkPermission(locals, 'finances.income', '*');
	const canViewBudget = isAdmin || isAccountant;

	const project = await prisma.project.findUnique({
		where: { id: projectId },
		include: {
			client: {
				select: {
					id: true,
					name: true,
					companyName: true
				}
			},
			projectManager: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					image: true
				}
			},
			assignedEmployees: {
				include: {
					user: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							jobTitle: true,
							image: true
						}
					}
				},
				orderBy: { assignedAt: 'asc' }
			},
			milestones: {
				orderBy: { date: 'asc' },
				select: {
					id: true,
					name: true,
					description: true,
					date: true,
					completed: true,
					completedAt: true
				}
			},
			tasks: {
				orderBy: { createdAt: 'desc' },
				take: 5,
				select: {
					id: true,
					name: true,
					status: true,
					priority: true,
					dueDate: true,
					assignedTo: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							image: true
						}
					}
				}
			},
			kanbanBoards: {
				orderBy: { createdAt: 'desc' },
				take: 5,
				select: {
					id: true,
					name: true,
					description: true,
					_count: {
						select: {
							members: true,
							tasks: true
						}
					}
				}
			},
			createdBy: {
				select: {
					id: true,
					name: true
				}
			},
			_count: {
				select: {
					tasks: true,
					milestones: true,
					kanbanBoards: true,
					assignedEmployees: true,
					income: true,
					expenses: true
				}
			}
		}
	});

	if (!project) {
		error(404, 'Project not found');
	}

	// Determine if user can manage project (admin or project manager)
	let canManageProject = isAdmin;
	if (!canManageProject && locals.user) {
		if (project.projectManagerId === locals.user.id) {
			canManageProject = true;
		}
	}

	// Load all active employees for team multi-select (only if user can manage)
	let allEmployees: Array<{ id: number; firstName: string | null; lastName: string | null; jobTitle: string | null; image: string | null }> = [];
	if (canManageProject) {
		allEmployees = await prisma.user.findMany({
			where: {
				employeeStatus: 'active'
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
				jobTitle: true,
				image: true
			},
			orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
		});
	}

	// Aggregate spent minutes from materialized spentTime on tasks (visible to all)
	const minutesAgg = await prisma.task.aggregate({
		where: { projectId },
		_sum: { spentTime: true }
	});
	const spentMinutes = minutesAgg._sum.spentTime ?? 0;

	// Aggregate financials if user can view budget
	let totalIncome = 0;
	let totalExpenses = 0;

	if (canViewBudget) {
		const [incomeAgg, expenseAgg] = await Promise.all([
			prisma.income.aggregate({
				where: { projectId },
				_sum: { amount: true }
			}),
			prisma.expense.aggregate({
				where: { projectId },
				_sum: { amount: true }
			})
		]);
		totalIncome = Number(incomeAgg._sum.amount || 0);
		totalExpenses = Number(expenseAgg._sum.amount || 0);
	}

	return {
		project: {
			...project,
			budgetEstimate: canViewBudget ? Number(project.budgetEstimate || 0) : null,
			estimatedHours: Number(project.estimatedHours || 0),
			totalIncome,
			totalExpenses,
			spentMinutes
		},
		canViewBudget,
		canManageProject,
		allEmployees
	};
};

export const actions: Actions = {
	updateTeam: async ({ locals, params, request }) => {
		await requirePermission(locals, 'projects', 'update');

		const projectId = parseInt(params.id);
		if (isNaN(projectId)) return fail(400, { error: 'Invalid project ID' });

		// Verify canManageProject
		const isAdmin = checkPermission(locals, '*', '*');
		let canManage = isAdmin;
		if (!canManage && locals.user) {
			const project = await prisma.project.findUnique({ where: { id: projectId }, select: { projectManagerId: true } });
			if (project?.projectManagerId === locals.user.id) canManage = true;
		}
		if (!canManage) return fail(403, { error: 'Not authorized to manage team' });

		const formData = await request.formData();
		const userIdsJson = formData.get('userIds') as string;

		let userIds: number[];
		try {
			userIds = JSON.parse(userIdsJson);
			if (!Array.isArray(userIds)) throw new Error();
		} catch {
			return fail(400, { error: 'Invalid user IDs' });
		}

		// Get old team for audit
		const oldTeam = await prisma.projectEmployee.findMany({
			where: { projectId },
			select: { userId: true }
		});

		// Replace team: delete all, recreate
		await prisma.$transaction([
			prisma.projectEmployee.deleteMany({ where: { projectId } }),
			...userIds.map((userId) =>
				prisma.projectEmployee.create({
					data: { projectId, userId }
				})
			)
		]);

		await logUpdate(
			locals.user!.id,
			'projects',
			String(projectId),
			'Project',
			{ teamMemberIds: oldTeam.map((t) => t.userId) },
			{ teamMemberIds: userIds }
		);

		return { success: true };
	},

	createMilestone: async ({ locals, params, request }) => {
		await requirePermission(locals, 'projects', 'update');

		const projectId = parseInt(params.id);
		if (isNaN(projectId)) return fail(400, { error: 'Invalid project ID' });

		// Verify canManageProject
		const isAdmin = checkPermission(locals, '*', '*');
		let canManage = isAdmin;
		if (!canManage && locals.user) {
			const project = await prisma.project.findUnique({ where: { id: projectId }, select: { projectManagerId: true } });
			if (project?.projectManagerId === locals.user.id) canManage = true;
		}
		if (!canManage) return fail(403, { error: 'Not authorized to manage milestones' });

		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();
		const description = (formData.get('description') as string)?.trim() || null;
		const dateStr = formData.get('date') as string;

		if (!name) return fail(400, { error: 'Name is required' });
		if (!dateStr) return fail(400, { error: 'Date is required' });

		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return fail(400, { error: 'Invalid date' });

		const milestone = await prisma.milestone.create({
			data: {
				projectId,
				name,
				description,
				date
			}
		});

		await logCreate(
			locals.user!.id,
			'projects',
			String(milestone.id),
			'Milestone',
			{ name, description, date: dateStr, projectId }
		);

		return { success: true };
	},

	deleteMilestone: async ({ locals, params, request }) => {
		await requirePermission(locals, 'projects', 'update');

		const projectId = parseInt(params.id);
		if (isNaN(projectId)) return fail(400, { error: 'Invalid project ID' });

		// Verify canManageProject
		const isAdmin = checkPermission(locals, '*', '*');
		let canManage = isAdmin;
		if (!canManage && locals.user) {
			const project = await prisma.project.findUnique({ where: { id: projectId }, select: { projectManagerId: true } });
			if (project?.projectManagerId === locals.user.id) canManage = true;
		}
		if (!canManage) return fail(403, { error: 'Not authorized to manage milestones' });

		const formData = await request.formData();
		const milestoneId = parseInt(formData.get('milestoneId') as string);
		if (isNaN(milestoneId)) return fail(400, { error: 'Invalid milestone ID' });

		// Verify milestone belongs to this project
		const milestone = await prisma.milestone.findFirst({
			where: { id: milestoneId, projectId }
		});
		if (!milestone) return fail(404, { error: 'Milestone not found' });

		await logDelete(
			locals.user!.id,
			'projects',
			String(milestoneId),
			'Milestone',
			{ name: milestone.name, projectId }
		);

		await prisma.milestone.delete({
			where: { id: milestoneId }
		});

		return { success: true };
	}
};
