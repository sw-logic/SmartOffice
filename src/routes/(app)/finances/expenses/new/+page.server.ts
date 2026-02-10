import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail, redirect } from '@sveltejs/kit';
import { logCreate } from '$lib/server/audit';
import { calculateDueDate, fetchDenormalizedName } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'finances.expenses', 'create');

	const [vendors, projects] = await Promise.all([
		// Get vendors for dropdown
		prisma.vendor.findMany({
			where: { status: 'active' },
			select: { id: true, name: true, paymentTerms: true },
			orderBy: { name: 'asc' }
		}),
		// Get projects for dropdown
		prisma.project.findMany({
			where: { status: { in: ['planning', 'active'] } },
			select: {
				id: true,
				name: true,
				client: { select: { id: true, name: true } }
			},
			orderBy: { name: 'asc' }
		})
	]);

	return {
		vendors,
		projects
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		await requirePermission(locals, 'finances.expenses', 'create');

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

		// Create expense
		const parsedAmount = parseFloat(amount);
		const parsedVendorId = vendorId ? parseInt(vendorId) : null;

		// Denormalize vendor name
		const vendorName = await fetchDenormalizedName('vendor', parsedVendorId);

		const expense = await prisma.expense.create({
			data: {
				amount: parsedAmount,
				tax: 0,
				tax_value: 0,
				currency,
				date: new Date(date),
				description: description.trim(),
				category,
				status,
				paymentTermDays,
				dueDate: calculateDueDate(new Date(date), paymentTermDays),
				isRecurring,
				recurringPeriod: isRecurring ? recurringPeriod : null,
				vendorId: parsedVendorId,
				vendorName,
				projectId: projectId ? parseInt(projectId) : null,
				notes: notes?.trim() || null,
				createdById: locals.user!.id
			}
		});

		await logCreate(locals.user!.id, 'finances.expenses', String(expense.id), 'Expense', {
			amount: expense.amount,
			description: expense.description,
			category: expense.category,
			date: expense.date,
			status: expense.status
		});

		redirect(303, '/finances/expenses');
	}
};
