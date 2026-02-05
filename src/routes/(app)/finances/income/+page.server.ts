import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete, logUpdate } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'finances.income', 'read');

	const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;

	// Get date range parameters (default to current month)
	const now = new Date();
	const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
	const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

	const startDate = url.searchParams.get('startDate') || defaultStart;
	const endDate = url.searchParams.get('endDate') || defaultEnd;

	// Other filters
	const search = url.searchParams.get('search') || '';
	const status = url.searchParams.get('status') || '';
	const category = url.searchParams.get('category') || '';
	const clientId = url.searchParams.get('clientId') || '';
	const isRecurring = url.searchParams.get('isRecurring') || '';
	const sortBy = url.searchParams.get('sortBy') || 'date';
	const sortOrder = url.searchParams.get('sortOrder') || 'desc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = 50;

	// Build where clause
	const where: any = {
		deletedAt: null,
		date: {
			gte: new Date(startDate),
			lte: new Date(endDate + 'T23:59:59.999Z')
		}
	};

	if (search) {
		where.OR = [
			{ description: { contains: search, mode: 'insensitive' } },
			{ invoiceReference: { contains: search, mode: 'insensitive' } },
			{ client: { name: { contains: search, mode: 'insensitive' } } }
		];
	}

	if (status) {
		where.status = status;
	}

	if (category) {
		where.category = category;
	}

	if (clientId) {
		where.clientId = clientId;
	}

	if (isRecurring === 'true') {
		where.isRecurring = true;
	} else if (isRecurring === 'false') {
		where.isRecurring = false;
	}

	// Build orderBy
	const orderBy: any = {};
	orderBy[sortBy] = sortOrder;

	// Get total count
	const totalCount = await prisma.income.count({ where });

	// Get income records
	const incomes = await prisma.income.findMany({
		where,
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
			invoiceReference: true,
			taxRate: true,
			notes: true,
			client: {
				select: {
					id: true,
					name: true
				}
			},
			project: {
				select: {
					id: true,
					name: true
				}
			}
		},
		orderBy,
		skip: (page - 1) * pageSize,
		take: pageSize
	});

	// Calculate summary totals for the filtered period
	const summaryData = await prisma.income.aggregate({
		where,
		_sum: {
			amount: true
		},
		_count: true
	});

	// Calculate tax totals (need to do this manually since tax is calculated per item)
	const incomesForTax = await prisma.income.findMany({
		where,
		select: {
			amount: true,
			taxRate: true
		}
	});

	let totalTaxAmount = 0;
	let totalNetAmount = 0;
	for (const income of incomesForTax) {
		const amount = Number(income.amount);
		const taxRate = income.taxRate ? Number(income.taxRate) : 0;
		const taxAmount = amount * (taxRate / 100);
		totalTaxAmount += taxAmount;
		totalNetAmount += amount - taxAmount;
	}

	// Get clients for filter dropdown
	const clients = await prisma.client.findMany({
		where: { deletedAt: null },
		select: { id: true, name: true },
		orderBy: { name: 'asc' }
	});

	// Get distinct categories
	const categories = [
		'project_payment',
		'consulting',
		'product_sale',
		'subscription',
		'commission',
		'refund',
		'other'
	];

	// Convert Decimal fields to numbers for serialization
	const serializedIncomes = incomes.map(inc => ({
		...inc,
		amount: Number(inc.amount),
		taxRate: inc.taxRate ? Number(inc.taxRate) : null
	}));

	return {
		incomes: serializedIncomes,
		clients,
		categories,
		summary: {
			totalAmount: summaryData._sum.amount ? Number(summaryData._sum.amount) : 0,
			totalTaxAmount,
			totalNetAmount,
			count: summaryData._count
		},
		totalCount,
		page,
		pageSize,
		totalPages: Math.ceil(totalCount / pageSize),
		filters: {
			startDate,
			endDate,
			search,
			status,
			category,
			clientId,
			isRecurring,
			sortBy,
			sortOrder
		},
		isAdmin
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		await requirePermission(locals, 'finances.income', 'delete');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Income ID is required' });
		}
		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid income ID' });
		}

		const income = await prisma.income.findFirst({
			where: { id, deletedAt: null },
			select: {
				id: true,
				amount: true,
				description: true,
				category: true,
				date: true
			}
		});

		if (!income) {
			return fail(404, { error: 'Income not found' });
		}

		await prisma.income.update({
			where: { id },
			data: { deletedAt: new Date() }
		});

		await logDelete(locals.user!.id, 'finances.income', String(id), 'Income', {
			amount: income.amount,
			description: income.description,
			category: income.category,
			date: income.date
		});

		return { success: true };
	},

	updateStatus: async ({ locals, request }) => {
		await requirePermission(locals, 'finances.income', 'update');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;
		const status = formData.get('status') as string;

		if (!idStr || !status) {
			return fail(400, { error: 'Income ID and status are required' });
		}
		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid income ID' });
		}

		const income = await prisma.income.findFirst({
			where: { id, deletedAt: null },
			select: { id: true, status: true }
		});

		if (!income) {
			return fail(404, { error: 'Income not found' });
		}

		await prisma.income.update({
			where: { id },
			data: { status }
		});

		await logUpdate(
			locals.user!.id,
			'finances.income',
			String(id),
			'Income',
			{ status: income.status },
			{ status }
		);

		return { success: true };
	}
};
