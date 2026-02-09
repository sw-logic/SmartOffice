import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';
import { generateExpenseOccurrences } from '$lib/server/recurring';

export const POST: RequestHandler = async ({ locals, request }) => {
	await requirePermission(locals, 'finances.expenses', 'create');

	const body = await request.json();

	// Validation
	if (!body.amount || isNaN(parseFloat(body.amount)) || parseFloat(body.amount) <= 0) {
		return json({ error: 'Please enter a valid amount' }, { status: 400 });
	}
	if (!body.date) {
		return json({ error: 'Date is required' }, { status: 400 });
	}
	if (!body.description?.trim()) {
		return json({ error: 'Description is required' }, { status: 400 });
	}
	if (!body.category) {
		return json({ error: 'Category is required' }, { status: 400 });
	}
	if (body.tax == null || body.tax === '' || isNaN(parseFloat(body.tax)) || parseFloat(body.tax) < 0 || parseFloat(body.tax) > 100) {
		return json({ error: 'Tax (%) is required and must be between 0 and 100' }, { status: 400 });
	}
	if (body.isRecurring && !body.recurringPeriod) {
		return json({ error: 'Please select a recurring period' }, { status: 400 });
	}

	const parsedAmount = parseFloat(body.amount);
	const parsedTax = parseFloat(body.tax);
	const taxValue = parsedAmount * (parsedTax / 100);
	const vendorId = body.vendorId ? parseInt(body.vendorId) : null;

	// Denormalize vendor name
	let vendorName: string | null = null;
	if (vendorId) {
		const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { name: true } });
		vendorName = vendor?.name ?? null;
	}

	const expense = await prisma.expense.create({
		data: {
			amount: parsedAmount,
			tax: parsedTax,
			tax_value: Math.round(taxValue * 100) / 100,
			currency: body.currency || 'USD',
			date: new Date(body.date),
			description: body.description.trim(),
			category: body.category,
			status: body.status || 'pending',
			paymentTermDays: body.paymentTermDays ? parseInt(body.paymentTermDays) : null,
			dueDate: body.paymentTermDays ? new Date(new Date(body.date).getTime() + parseInt(body.paymentTermDays) * 86400000) : null,
			isRecurring: body.isRecurring || false,
			recurringPeriod: body.isRecurring ? body.recurringPeriod : null,
			recurringEndDate: body.isRecurring && body.recurringEndDate ? new Date(body.recurringEndDate) : null,
			vendorId,
			vendorName,
			projectId: body.projectId ? parseInt(body.projectId) : null,
			notes: body.notes?.trim() || null,
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

	// Generate projected occurrences if recurring with end date
	let projectedCount = 0;
	if (body.isRecurring && body.recurringEndDate) {
		projectedCount = await generateExpenseOccurrences(expense.id, locals.user!.id);
	}

	return json({ expense, projectedCount }, { status: 201 });
};
