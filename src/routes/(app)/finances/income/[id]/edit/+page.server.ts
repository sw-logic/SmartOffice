import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail, redirect, error } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';
import { parseId, calculateDueDate, fetchDenormalizedName } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'finances.income', 'update');

	const incomeId = parseId(params.id, 'income');

	const [income, clients, projects] = await Promise.all([
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
				paymentTermDays: true,
				isRecurring: true,
				recurringPeriod: true,
				clientId: true,
				projectId: true,
				invoiceReference: true,
				taxRate: true,
				notes: true
			}
		}),
		// Get clients for dropdown
		prisma.client.findMany({
			select: { id: true, name: true, paymentTerms: true },
			orderBy: { name: 'asc' }
		}),
		// Get projects for dropdown
		prisma.project.findMany({
			select: {
				id: true,
				name: true,
				client: { select: { id: true, name: true } }
			},
			orderBy: { name: 'asc' }
		})
	]);

	if (!income) {
		error(404, 'Income not found');
	}

	// Convert Decimal fields to numbers for serialization
	return {
		income: {
			...income,
			amount: Number(income.amount),
			taxRate: income.taxRate ? Number(income.taxRate) : null,
			paymentTermDays: income.paymentTermDays,
			date: income.date.toISOString().split('T')[0],
			dueDate: income.dueDate ? income.dueDate.toISOString().split('T')[0] : ''
		},
		clients,
		projects
	};
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		await requirePermission(locals, 'finances.income', 'update');

		const incomeId = parseId(params.id, 'income');

		const formData = await request.formData();

		const amount = formData.get('amount') as string;
		const currency = (formData.get('currency') as string) || 'USD';
		const date = formData.get('date') as string;
		const description = formData.get('description') as string;
		const category = formData.get('category') as string;
		const status = (formData.get('status') as string) || 'pending';
		const paymentTermDaysStr = formData.get('paymentTermDays') as string;
		const paymentTermDays = paymentTermDaysStr ? parseInt(paymentTermDaysStr) : null;
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
					paymentTermDays: paymentTermDaysStr,
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
				paymentTermDays: true,
				isRecurring: true,
				recurringPeriod: true,
				clientId: true,
				projectId: true,
				invoiceReference: true,
				taxRate: true,
				notes: true
			}
		});

		// Denormalize client name
		const parsedClientId = clientId ? parseInt(clientId) : null;
		const clientName = await fetchDenormalizedName('client', parsedClientId);

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
				paymentTermDays,
				dueDate: calculateDueDate(new Date(date), paymentTermDays),
				isRecurring,
				recurringPeriod: isRecurring ? recurringPeriod : null,
				clientId: parsedClientId,
				clientName,
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
