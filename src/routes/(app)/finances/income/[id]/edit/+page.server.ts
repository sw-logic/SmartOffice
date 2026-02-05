import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail, redirect, error } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';
import { getEnumValuesBatch } from '$lib/server/enums';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'finances.income', 'update');

	// Parse income ID
	const incomeId = parseInt(params.id);
	if (isNaN(incomeId)) {
		error(400, 'Invalid income ID');
	}

	const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;

	const [income, clients, projects, enums] = await Promise.all([
		prisma.income.findUnique({
			where: { id: incomeId },
			select: {
				id: true,
				amount: true,
				currency: true,
				date: true,
				description: true,
				category: true,
				status: true,
				dueDate: true,
				isRecurring: true,
				recurringPeriod: true,
				clientId: true,
				projectId: true,
				invoiceReference: true,
				taxRate: true,
				notes: true,
				deletedAt: true
			}
		}),
		// Get clients for dropdown
		prisma.client.findMany({
			where: { deletedAt: null },
			select: { id: true, name: true },
			orderBy: { name: 'asc' }
		}),
		// Get projects for dropdown
		prisma.project.findMany({
			where: { deletedAt: null },
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

	if (!income) {
		error(404, 'Income not found');
	}

	if (income.deletedAt && !isAdmin) {
		error(403, 'Only administrators can edit deleted records');
	}

	// Convert Decimal fields to numbers for serialization
	return {
		income: {
			...income,
			amount: Number(income.amount),
			taxRate: income.taxRate ? Number(income.taxRate) : null,
			isDeleted: income.deletedAt !== null,
			date: income.date.toISOString().split('T')[0],
			dueDate: income.dueDate ? income.dueDate.toISOString().split('T')[0] : ''
		},
		clients,
		projects,
		categories: enums.income_category,
		currencies: enums.currency,
		statuses: enums.income_status,
		recurringPeriods: enums.recurring_period,
		isAdmin
	};
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		await requirePermission(locals, 'finances.income', 'update');

		// Parse income ID
		const incomeId = parseInt(params.id);
		if (isNaN(incomeId)) {
			return fail(400, { error: 'Invalid income ID' });
		}

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

		// Get old values for audit
		const oldIncome = await prisma.income.findUnique({
			where: { id: incomeId },
			select: {
				amount: true,
				currency: true,
				date: true,
				description: true,
				category: true,
				status: true,
				dueDate: true,
				isRecurring: true,
				recurringPeriod: true,
				clientId: true,
				projectId: true,
				invoiceReference: true,
				taxRate: true,
				notes: true
			}
		});

		// Update income
		const updatedIncome = await prisma.income.update({
			where: { id: incomeId },
			data: {
				amount: parseFloat(amount),
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
				notes: notes?.trim() || null
			}
		});

		await logUpdate(locals.user!.id, 'finances.income', String(incomeId), 'Income', oldIncome || {}, {
			amount: updatedIncome.amount,
			currency: updatedIncome.currency,
			date: updatedIncome.date,
			description: updatedIncome.description,
			category: updatedIncome.category,
			status: updatedIncome.status,
			dueDate: updatedIncome.dueDate,
			isRecurring: updatedIncome.isRecurring,
			recurringPeriod: updatedIncome.recurringPeriod
		});

		redirect(303, `/finances/income/${params.id}`);
	}
};
