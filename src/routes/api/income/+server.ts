import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';

export const POST: RequestHandler = async ({ locals, request }) => {
	await requirePermission(locals, 'finances.income', 'create');

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

	const income = await prisma.income.create({
		data: {
			amount: parsedAmount,
			tax: parsedTax,
			tax_value: Math.round(taxValue * 100) / 100,
			currency: body.currency || 'USD',
			date: new Date(body.date),
			description: body.description.trim(),
			category: body.category,
			status: body.status || 'pending',
			dueDate: body.dueDate ? new Date(body.dueDate) : null,
			isRecurring: body.isRecurring || false,
			recurringPeriod: body.isRecurring ? body.recurringPeriod : null,
			clientId: body.clientId ? parseInt(body.clientId) : null,
			projectId: body.projectId ? parseInt(body.projectId) : null,
			invoiceReference: body.invoiceReference?.trim() || null,
			taxRate: body.taxRate ? parseFloat(body.taxRate) : null,
			notes: body.notes?.trim() || null,
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

	return json({ income }, { status: 201 });
};
