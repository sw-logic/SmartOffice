import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail, redirect } from '@sveltejs/kit';
import { logCreate } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'projects', 'create');

	const isAdmin = checkPermission(locals, '*', '*');
	const isAccountant = checkPermission(locals, 'finances.income', '*');
	const canViewBudget = isAdmin || isAccountant;

	const preselectedClientId = url.searchParams.get('clientId') || '';

	const [clients, employees] = await Promise.all([
		prisma.client.findMany({
			where: { status: 'active' },
			select: { id: true, name: true },
			orderBy: { name: 'asc' }
		}),
		prisma.user.findMany({
			where: {
				employeeStatus: 'active'
			},
			select: { id: true, firstName: true, lastName: true },
			orderBy: { firstName: 'asc' }
		})
	]);

	return {
		clients,
		employees,
		preselectedClientId,
		canViewBudget
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		await requirePermission(locals, 'projects', 'create');

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

		// Get the company
		let company = await prisma.company.findFirst();
		if (!company) {
			company = await prisma.company.create({
				data: {
					name: 'Default Company',
					currency: 'USD'
				}
			});
		}

		const projectManagerId = projectManagerIdStr ? parseInt(projectManagerIdStr) : null;

		const project = await prisma.project.create({
			data: {
				companyId: company.id,
				name: name.trim(),
				description: description?.trim() || null,
				clientId,
				status,
				priority,
				startDate: startDate ? new Date(startDate) : null,
				endDate: endDate ? new Date(endDate) : null,
				budgetEstimate: budgetEstimate ? parseFloat(budgetEstimate) : null,
				estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
				projectManagerId,
				createdById: locals.user!.id
			}
		});

		await logCreate(locals.user!.id, 'projects', String(project.id), 'Project', {
			name: project.name,
			clientId: project.clientId,
			status: project.status,
			priority: project.priority
		});

		redirect(303, `/projects/${project.id}`);
	}
};
