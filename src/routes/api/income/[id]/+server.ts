import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, isAdmin } from '$lib/server/access-control';
import { logUpdate } from '$lib/server/audit';
import { generateIncomeOccurrences } from '$lib/server/recurring';

export const GET: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'finances.income', 'read');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid income ID' }, { status: 400 });
	}

	const income = await prisma.income.findUnique({
		where: { id },
		include: {
			client: { select: { id: true, name: true } },
			project: { select: { id: true, name: true } }
		}
	});

	if (!income) {
		return json({ error: 'Income not found' }, { status: 404 });
	}

	return json({
		income: {
			...income,
			amount: Number(income.amount),
			tax: Number(income.tax),
			tax_value: Number(income.tax_value),
			taxRate: income.taxRate ? Number(income.taxRate) : null
		}
	});
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	await requirePermission(locals, 'finances.income', 'update');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid income ID' }, { status: 400 });
	}

	const existing = await prisma.income.findUnique({
		where: { id },
		select: {
			id: true,
			amount: true,
			tax: true,
			tax_value: true,
			currency: true,
			date: true,
			description: true,
			category: true,
			status: true,
			dueDate: true,
			paymentTermDays: true,
			isRecurring: true,
			recurringPeriod: true,
			recurringEndDate: true,
			parentId: true,
			clientId: true,
			projectId: true,
			invoiceReference: true,
			taxRate: true,
			notes: true,
			createdById: true
		}
	});

	if (!existing) {
		return json({ error: 'Income not found' }, { status: 404 });
	}

	// Row-level access: only the creator or an admin can update income records
	const userId = locals.user!.id;
	if (existing.createdById !== userId && !(await isAdmin(locals))) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body = await request.json();

	// Validation
	if ('amount' in body && (!body.amount || isNaN(parseFloat(body.amount)) || parseFloat(body.amount) <= 0)) {
		return json({ error: 'Please enter a valid amount' }, { status: 400 });
	}
	if ('description' in body && !body.description?.trim()) {
		return json({ error: 'Description is required' }, { status: 400 });
	}
	if ('category' in body && !body.category) {
		return json({ error: 'Category is required' }, { status: 400 });
	}
	if ('date' in body && !body.date) {
		return json({ error: 'Date is required' }, { status: 400 });
	}
	if ('tax' in body && (body.tax == null || body.tax === '' || isNaN(parseFloat(body.tax)) || parseFloat(body.tax) < 0 || parseFloat(body.tax) > 100)) {
		return json({ error: 'Tax (%) must be between 0 and 100' }, { status: 400 });
	}
	if (body.isRecurring && !body.recurringPeriod) {
		return json({ error: 'Please select a recurring period' }, { status: 400 });
	}

	const data: Record<string, unknown> = {};
	const oldValues: Record<string, unknown> = {};

	const allowedFields = [
		'currency', 'description', 'category', 'status',
		'isRecurring', 'recurringPeriod', 'invoiceReference', 'notes'
	];

	// Handle recurringEndDate as a special date field
	if ('recurringEndDate' in body) {
		data.recurringEndDate = body.recurringEndDate ? new Date(body.recurringEndDate) : null;
		oldValues.recurringEndDate = existing.recurringEndDate;
	}

	for (const field of allowedFields) {
		if (field in body) {
			data[field] = body[field];
			oldValues[field] = (existing as Record<string, unknown>)[field];
		}
	}

	// Handle special fields
	if ('amount' in body) {
		data.amount = parseFloat(body.amount);
		oldValues.amount = existing.amount;
	}
	if ('tax' in body) {
		data.tax = parseFloat(body.tax);
		oldValues.tax = existing.tax;
	}
	if ('date' in body) {
		data.date = new Date(body.date);
		oldValues.date = existing.date;
	}
	if ('paymentTermDays' in body) {
		data.paymentTermDays = body.paymentTermDays ? parseInt(body.paymentTermDays) : null;
		oldValues.paymentTermDays = existing.paymentTermDays;
	}
	// Recalculate dueDate from date + paymentTermDays
	if ('paymentTermDays' in body || 'date' in body) {
		const finalDate = data.date ? (data.date as Date) : existing.date;
		const finalTermDays = 'paymentTermDays' in body
			? (body.paymentTermDays ? parseInt(body.paymentTermDays) : null)
			: existing.paymentTermDays;
		data.dueDate = finalTermDays ? new Date(new Date(finalDate).getTime() + finalTermDays * 86400000) : null;
		oldValues.dueDate = existing.dueDate;
	}
	if ('taxRate' in body) {
		data.taxRate = body.taxRate ? parseFloat(body.taxRate) : null;
		oldValues.taxRate = existing.taxRate;
	}
	if ('clientId' in body) {
		const newClientId = body.clientId ? parseInt(body.clientId) : null;
		data.clientId = newClientId;
		oldValues.clientId = existing.clientId;

		// Denormalize client name
		if (newClientId && newClientId !== existing.clientId) {
			const client = await prisma.client.findUnique({ where: { id: newClientId }, select: { name: true } });
			data.clientName = client?.name ?? null;
		} else if (!newClientId) {
			data.clientName = null;
		}
	}
	if ('projectId' in body) {
		data.projectId = body.projectId ? parseInt(body.projectId) : null;
		oldValues.projectId = existing.projectId;
	}

	// Recalculate tax_value if amount or tax changed
	if ('amount' in body || 'tax' in body) {
		const finalAmount = (data.amount as number) ?? Number(existing.amount);
		const finalTax = (data.tax as number) ?? Number(existing.tax);
		data.tax_value = Math.round(finalAmount * (finalTax / 100) * 100) / 100;
		oldValues.tax_value = existing.tax_value;
	}

	// Handle recurring logic
	if ('isRecurring' in body && !body.isRecurring) {
		data.recurringPeriod = null;
		data.recurringEndDate = null;
	}

	const updated = await prisma.income.update({
		where: { id },
		data
	});

	await logUpdate(locals.user!.id, 'finances.income', String(id), 'Income', oldValues, body);

	// Handle projected children regeneration
	let projectedCount = 0;
	const isParent = updated.isRecurring && !updated.parentId;

	if (isParent && updated.recurringEndDate) {
		// Regenerate projected children when parent is updated
		projectedCount = await generateIncomeOccurrences(id, locals.user!.id);
	} else if ('isRecurring' in body && !body.isRecurring && !existing.parentId) {
		// Recurring was toggled off — delete all projected children
		await prisma.income.deleteMany({
			where: {
				parentId: id,
				status: 'projected'
			}
		});
	}

	return json({
		income: {
			...updated,
			amount: Number(updated.amount),
			tax: Number(updated.tax),
			tax_value: Number(updated.tax_value),
			taxRate: updated.taxRate ? Number(updated.taxRate) : null
		},
		projectedCount
	});
};
