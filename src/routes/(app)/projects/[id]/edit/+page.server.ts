import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail, redirect, error } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';
import { getEnumValuesBatch } from '$lib/server/enums';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'projects', 'update');

	const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;
	const isAccountant = locals.user
		? await checkPermission(locals.user.id, 'finances.income', '*')
		: false;
	const canViewBudget = isAdmin || isAccountant;

	const projectId = parseInt(params.id);
	if (isNaN(projectId)) {
		error(400, 'Invalid project ID');
	}

	const [project, enums, clients, persons] = await Promise.all([
		prisma.project.findUnique({
			where: { id: projectId },
			select: {
				id: true,
				name: true,
				description: true,
				clientId: true,
				status: true,
				priority: true,
				startDate: true,
				endDate: true,
				budgetEstimate: true,
				estimatedHours: true,
				projectManagerId: true,
				deletedAt: true
			}
		}),
		getEnumValuesBatch(['project_status', 'priority', 'currency']),
		prisma.client.findMany({
			where: { deletedAt: null, status: 'active' },
			select: { id: true, name: true },
			orderBy: { name: 'asc' }
		}),
		prisma.person.findMany({
			where: {
				deletedAt: null,
				personType: 'company_employee',
				employeeStatus: 'active'
			},
			select: { id: true, firstName: true, lastName: true },
			orderBy: { firstName: 'asc' }
		})
	]);

	if (!project) {
		error(404, 'Project not found');
	}

	if (project.deletedAt && !isAdmin) {
		error(403, 'Only administrators can edit deleted projects');
	}

	return {
		project: {
			...project,
			budgetEstimate: project.budgetEstimate ? Number(project.budgetEstimate) : null,
			estimatedHours: project.estimatedHours ? Number(project.estimatedHours) : null,
			isDeleted: project.deletedAt !== null
		},
		statuses: enums.project_status,
		priorities: enums.priority,
		clients,
		persons,
		isAdmin,
		canViewBudget
	};
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		await requirePermission(locals, 'projects', 'update');

		const formData = await request.formData();

		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const clientIdStr = formData.get('clientId') as string;
		const status = formData.get('status') as string || 'planning';
		const priority = formData.get('priority') as string || 'medium';
		const startDate = formData.get('startDate') as string;
		const endDate = formData.get('endDate') as string;
		const budgetEstimate = formData.get('budgetEstimate') as string;
		const estimatedHours = formData.get('estimatedHours') as string;
		const projectManagerIdStr = formData.get('projectManagerId') as string;
		// Validation
		const errors: Record<string, string> = {};

		if (!name?.trim()) {
			errors.name = 'Project name is required';
		}

		if (!clientIdStr) {
			errors.clientId = 'Client is required';
		}

		const clientId = parseInt(clientIdStr);
		if (clientIdStr && isNaN(clientId)) {
			errors.clientId = 'Invalid client';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, {
				errors,
				values: {
					name,
					description,
					clientId: clientIdStr,
					status,
					priority,
					startDate,
					endDate,
					budgetEstimate,
					estimatedHours,
					projectManagerId: projectManagerIdStr
				}
			});
		}

		const projectId = parseInt(params.id);

		// Get old values for audit
		const oldProject = await prisma.project.findUnique({
			where: { id: projectId },
			select: {
				name: true,
				description: true,
				clientId: true,
				status: true,
				priority: true,
				startDate: true,
				endDate: true,
				budgetEstimate: true,
				estimatedHours: true,
				projectManagerId: true
			}
		});

		const projectManagerId = projectManagerIdStr ? parseInt(projectManagerIdStr) : null;

		const updatedProject = await prisma.project.update({
			where: { id: projectId },
			data: {
				name: name.trim(),
				description: description?.trim() || null,
				clientId,
				status,
				priority,
				startDate: startDate ? new Date(startDate) : null,
				endDate: endDate ? new Date(endDate) : null,
				budgetEstimate: budgetEstimate ? parseFloat(budgetEstimate) : null,
				estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
				projectManagerId
			}
		});

		await logUpdate(
			locals.user!.id,
			'projects',
			String(projectId),
			'Project',
			oldProject || {},
			{
				name: updatedProject.name,
				description: updatedProject.description,
				clientId: updatedProject.clientId,
				status: updatedProject.status,
				priority: updatedProject.priority,
				startDate: updatedProject.startDate,
				endDate: updatedProject.endDate,
				budgetEstimate: Number(updatedProject.budgetEstimate),
				estimatedHours: Number(updatedProject.estimatedHours),
				projectManagerId: updatedProject.projectManagerId
			}
		);

		redirect(303, `/projects/${projectId}`);
	}
};
