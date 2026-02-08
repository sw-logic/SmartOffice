import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail, redirect, error } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'finances.expenses', 'update');

	// Parse expense ID
	const expenseId = parseInt(params.id);
	if (isNaN(expenseId)) {
		error(400, 'Invalid expense ID');
	}

	const isAdmin = checkPermission(locals, '*', '*');

	const [expense, vendors, projects] = await Promise.all([
		prisma.expense.findUnique({
			where: { id: expenseId },
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
				vendorId: true,
				projectId: true,
				receiptPath: true,
				notes: true,
				deletedAt: true
			}
		}),
		// Get vendors for dropdown
		prisma.vendor.findMany({
			where: { deletedAt: null },
			select: { id: true, name: true, paymentTerms: true },
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
		})
	]);

	if (!expense) {
		error(404, 'Expense not found');
	}

	if (expense.deletedAt && !isAdmin) {
		error(403, 'Only administrators can edit deleted records');
	}

	// Convert Decimal fields to numbers for serialization
	return {
		expense: {
			...expense,
			amount: Number(expense.amount),
			paymentTermDays: expense.paymentTermDays,
			isDeleted: expense.deletedAt !== null,
			date: expense.date.toISOString().split('T')[0],
			dueDate: expense.dueDate ? expense.dueDate.toISOString().split('T')[0] : ''
		},
		vendors,
		projects,
		isAdmin
	};
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		await requirePermission(locals, 'finances.expenses', 'update');

		// Parse expense ID
		const expenseId = parseInt(params.id);
		if (isNaN(expenseId)) {
			return fail(400, { error: 'Invalid expense ID' });
		}

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
		const vendorId = formData.get('vendorId') as string;
		const projectId = formData.get('projectId') as string;
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
					vendorId,
					projectId,
					notes
				}
			});
		}

		// Get old values for audit
		const oldExpense = await prisma.expense.findUnique({
			where: { id: expenseId },
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
				vendorId: true,
				projectId: true,
				notes: true
			}
		});

		// Update expense
		const updatedExpense = await prisma.expense.update({
			where: { id: expenseId },
			data: {
				amount: parseFloat(amount),
				currency,
				date: new Date(date),
				description: description.trim(),
				category,
				status,
				paymentTermDays,
				dueDate: paymentTermDays && date ? new Date(new Date(date).getTime() + paymentTermDays * 86400000) : null,
				isRecurring,
				recurringPeriod: isRecurring ? recurringPeriod : null,
				vendorId: vendorId ? parseInt(vendorId) : null,
				projectId: projectId ? parseInt(projectId) : null,
				notes: notes?.trim() || null
			}
		});

		await logUpdate(locals.user!.id, 'finances.expenses', String(expenseId), 'Expense', oldExpense || {}, {
			amount: updatedExpense.amount,
			currency: updatedExpense.currency,
			date: updatedExpense.date,
			description: updatedExpense.description,
			category: updatedExpense.category,
			status: updatedExpense.status,
			dueDate: updatedExpense.dueDate,
			isRecurring: updatedExpense.isRecurring,
			recurringPeriod: updatedExpense.recurringPeriod
		});

		redirect(303, `/finances/expenses/${params.id}`);
	}
};
