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

	const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;

	// Budget visible to admin or accountant
	const isAccountant = locals.user
		? await checkPermission(locals.user.id, 'finances.income', '*')
		: false;
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
					jobTitle: true
				}
			},
			assignedEmployees: {
				include: {
					person: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							jobTitle: true
						}
					}
				},
				orderBy: { assignedAt: 'asc' }
			},
			milestones: {
				where: { deletedAt: null },
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
				where: { deletedAt: null },
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
							lastName: true
						}
					}
				}
			},
			kanbanBoards: {
				where: { deletedAt: null },
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
					tasks: { where: { deletedAt: null } },
					milestones: { where: { deletedAt: null } },
					kanbanBoards: { where: { deletedAt: null } },
					assignedEmployees: true,
					income: { where: { deletedAt: null } },
					expenses: { where: { deletedAt: null } }
				}
			}
		}
	});

	if (!project) {
		error(404, 'Project not found');
	}

	if (project.deletedAt && !isAdmin) {
		error(403, 'Access denied');
	}

	// Determine if user can manage project (admin or project manager)
	let canManageProject = isAdmin;
	if (!canManageProject && locals.user) {
		const person = await prisma.person.findFirst({
			where: { userId: locals.user.id },
			select: { id: true }
		});
		if (person && project.projectManagerId === person.id) {
			canManageProject = true;
		}
	}

	// Load all active employees for team multi-select (only if user can manage)
	let allEmployees: Array<{ id: number; firstName: string; lastName: string; jobTitle: string | null }> = [];
	if (canManageProject) {
		allEmployees = await prisma.person.findMany({
			where: {
				personType: 'company_employee',
				employeeStatus: 'active',
				deletedAt: null
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
				jobTitle: true
			},
			orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
		});
	}

	// Aggregate spent hours (visible to all)
	const hoursAgg = await prisma.timeRecord.aggregate({
		where: {
			task: { projectId, deletedAt: null },
			deletedAt: null
		},
		_sum: { hours: true }
	});
	const spentHours = Number(hoursAgg._sum.hours || 0);

	// Aggregate financials if user can view budget
	let totalIncome = 0;
	let totalExpenses = 0;

	if (canViewBudget) {
		const [incomeAgg, expenseAgg] = await Promise.all([
			prisma.income.aggregate({
				where: { projectId, deletedAt: null },
				_sum: { amount: true }
			}),
			prisma.expense.aggregate({
				where: { projectId, deletedAt: null },
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
			isDeleted: project.deletedAt !== null,
			totalIncome,
			totalExpenses,
			spentHours
		},
		isAdmin,
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
		const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;
		let canManage = isAdmin;
		if (!canManage && locals.user) {
			const project = await prisma.project.findUnique({ where: { id: projectId }, select: { projectManagerId: true } });
			const person = await prisma.person.findFirst({ where: { userId: locals.user.id }, select: { id: true } });
			if (person && project?.projectManagerId === person.id) canManage = true;
		}
		if (!canManage) return fail(403, { error: 'Not authorized to manage team' });

		const formData = await request.formData();
		const personIdsJson = formData.get('personIds') as string;

		let personIds: number[];
		try {
			personIds = JSON.parse(personIdsJson);
			if (!Array.isArray(personIds)) throw new Error();
		} catch {
			return fail(400, { error: 'Invalid person IDs' });
		}

		// Get old team for audit
		const oldTeam = await prisma.projectEmployee.findMany({
			where: { projectId },
			select: { personId: true }
		});

		// Replace team: delete all, recreate
		await prisma.$transaction([
			prisma.projectEmployee.deleteMany({ where: { projectId } }),
			...personIds.map((personId) =>
				prisma.projectEmployee.create({
					data: { projectId, personId }
				})
			)
		]);

		await logUpdate(
			locals.user!.id,
			'projects',
			String(projectId),
			'Project',
			{ teamMemberIds: oldTeam.map((t) => t.personId) },
			{ teamMemberIds: personIds }
		);

		return { success: true };
	},

	createMilestone: async ({ locals, params, request }) => {
		await requirePermission(locals, 'projects', 'update');

		const projectId = parseInt(params.id);
		if (isNaN(projectId)) return fail(400, { error: 'Invalid project ID' });

		// Verify canManageProject
		const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;
		let canManage = isAdmin;
		if (!canManage && locals.user) {
			const project = await prisma.project.findUnique({ where: { id: projectId }, select: { projectManagerId: true } });
			const person = await prisma.person.findFirst({ where: { userId: locals.user.id }, select: { id: true } });
			if (person && project?.projectManagerId === person.id) canManage = true;
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
		const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;
		let canManage = isAdmin;
		if (!canManage && locals.user) {
			const project = await prisma.project.findUnique({ where: { id: projectId }, select: { projectManagerId: true } });
			const person = await prisma.person.findFirst({ where: { userId: locals.user.id }, select: { id: true } });
			if (person && project?.projectManagerId === person.id) canManage = true;
		}
		if (!canManage) return fail(403, { error: 'Not authorized to manage milestones' });

		const formData = await request.formData();
		const milestoneId = parseInt(formData.get('milestoneId') as string);
		if (isNaN(milestoneId)) return fail(400, { error: 'Invalid milestone ID' });

		// Verify milestone belongs to this project
		const milestone = await prisma.milestone.findFirst({
			where: { id: milestoneId, projectId, deletedAt: null }
		});
		if (!milestone) return fail(404, { error: 'Milestone not found' });

		// Soft delete
		await prisma.milestone.update({
			where: { id: milestoneId },
			data: { deletedAt: new Date() }
		});

		await logDelete(
			locals.user!.id,
			'projects',
			String(milestoneId),
			'Milestone',
			{ name: milestone.name, projectId }
		);

		return { success: true };
	}
};
