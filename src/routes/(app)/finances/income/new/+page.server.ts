import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail, redirect } from '@sveltejs/kit';
import { logCreate } from '$lib/server/audit';
import { getEnumValuesBatch } from '$lib/server/enums';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'finances.income', 'create');

	const [clients, projects, enums] = await Promise.all([
		// Get clients for dropdown
		prisma.client.findMany({
			where: { deletedAt: null, status: 'active' },
			select: { id: true, name: true },
			orderBy: { name: 'asc' }
		}),
		// Get projects for dropdown
		prisma.project.findMany({
			where: { deletedAt: null, status: { in: ['planning', 'active'] } },
			select: {
				id: true,
				name: true,
				client: { select: { id: true, name: true } }
			},
			orderBy: { name: 'asc' }
		}),
		// Get enum values
		getEnumValuesBatch(['income_category', 'currency', 'income_status', 'recurring_period'])
	]);

	return {
		clients,
		projects,
		categories: enums.income_category,
		currencies: enums.currency,
		statuses: enums.income_status,
		recurringPeriods: enums.recurring_period
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		await requirePermission(locals, 'finances.income', 'create');

		const formData = await request.formData();

		const amount = formData.get('amount') as string;
		const currency = (formData.get('currency') as string) || 'USD';
		const date = formData.get('date') as string;
		const description = formData.get('description') as string;
		const category = formData.get('category') as string;
		const status = (formData.get('status') as string) || 'pending';
		const dueDate = formData.get('dueDate') as string;
		const isRecurring = formData.get('isRecurring') === 'true';
		const recurringPeriod = formData.get('recurringPeriod') as string;
		const clientId = formData.get('clientId') as string;
		const projectId = formData.get('projectId') as string;
		const invoiceReference = formData.get('invoiceReference') as string;
		const taxRate = formData.get('taxRate') as string;
		const notes = formData.get('notes') as string;

		// Validation
		const errors: Record<string, string> = {};

		if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
			errors.amount = 'Please enter a valid amount';
		}

		if (!date) {
			errors.date = 'Date is required';
		}

		if (!description?.trim()) {
			errors.description = 'Description is required';
		}

		if (!category) {
			errors.category = 'Category is required';
		}

		if (isRecurring && !recurringPeriod) {
			errors.recurringPeriod = 'Please select a recurring period';
		}

		if (taxRate && (isNaN(parseFloat(taxRate)) || parseFloat(taxRate) < 0 || parseFloat(taxRate) > 100)) {
			errors.taxRate = 'Tax rate must be between 0 and 100';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, {
				errors,
				values: {
					amount,
					currency,
					date,
					description,
					category,
					status,
					dueDate,
					isRecurring,
					recurringPeriod,
					clientId,
					projectId,
					invoiceReference,
					taxRate,
					notes
				}
			});
		}

		// Create income
		const parsedAmount = parseFloat(amount);
		const parsedTax = taxRate ? parseFloat(taxRate) : 0;
		const income = await prisma.income.create({
			data: {
				amount: parsedAmount,
				tax: parsedTax,
				tax_value: Math.round(parsedAmount * (parsedTax / 100) * 100) / 100,
				currency,
				date: new Date(date),
				description: description.trim(),
				category,
				status,
				dueDate: dueDate ? new Date(dueDate) : null,
				isRecurring,
				recurringPeriod: isRecurring ? recurringPeriod : null,
				clientId: clientId ? parseInt(clientId) : null,
				projectId: projectId ? parseInt(projectId) : null,
				invoiceReference: invoiceReference?.trim() || null,
				taxRate: taxRate ? parseFloat(taxRate) : null,
				notes: notes?.trim() || null,
				createdById: locals.user!.id
			}
		});

		await logCreate(locals.user!.id, 'finances.income', String(income.id), 'Income', {
			amount: income.amount,
			description: income.description,
			category: income.category,
			date: income.date,
			status: income.status
		});

		redirect(303, '/finances/income');
	}
};
