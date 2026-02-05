import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete, logUpdate } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'finances.expenses', 'read');

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
	const vendorId = url.searchParams.get('vendorId') || '';
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
			{ vendor: { name: { contains: search, mode: 'insensitive' } } }
		];
	}

	if (status) {
		where.status = status;
	}

	if (category) {
		where.category = category;
	}

	if (vendorId) {
		where.vendorId = vendorId;
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
	const totalCount = await prisma.expense.count({ where });

	// Get expense records
	const expenses = await prisma.expense.findMany({
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
			taxDeductible: true,
			receiptPath: true,
			notes: true,
			vendor: {
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
	const summaryData = await prisma.expense.aggregate({
		where,
		_sum: {
			amount: true
		},
		_count: true
	});

	// Calculate tax deductible totals
	const taxDeductibleWhere = { ...where, taxDeductible: true };
	const taxDeductibleData = await prisma.expense.aggregate({
		where: taxDeductibleWhere,
		_sum: {
			amount: true
		}
	});

	// Get vendors for filter dropdown
	const vendors = await prisma.vendor.findMany({
		where: { deletedAt: null },
		select: { id: true, name: true },
		orderBy: { name: 'asc' }
	});

	// Get distinct categories
	const categories = [
		'salary',
		'software',
		'office',
		'marketing',
		'travel',
		'equipment',
		'contractor',
		'utilities',
		'rent',
		'insurance',
		'taxes',
		'other'
	];

	// Convert Decimal fields to numbers for serialization
	const serializedExpenses = expenses.map(exp => ({
		...exp,
		amount: Number(exp.amount)
	}));

	return {
		expenses: serializedExpenses,
		vendors,
		categories,
		summary: {
			totalAmount: summaryData._sum.amount ? Number(summaryData._sum.amount) : 0,
			taxDeductibleAmount: taxDeductibleData._sum.amount
				? Number(taxDeductibleData._sum.amount)
				: 0,
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
			vendorId,
			isRecurring,
			sortBy,
			sortOrder
		},
		isAdmin
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		await requirePermission(locals, 'finances.expenses', 'delete');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Expense ID is required' });
		}
		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid expense ID' });
		}

		const expense = await prisma.expense.findFirst({
			where: { id, deletedAt: null },
			select: {
				id: true,
				amount: true,
				description: true,
				category: true,
				date: true
			}
		});

		if (!expense) {
			return fail(404, { error: 'Expense not found' });
		}

		await prisma.expense.update({
			where: { id },
			data: { deletedAt: new Date() }
		});

		await logDelete(locals.user!.id, 'finances.expenses', String(id), 'Expense', {
			amount: expense.amount,
			description: expense.description,
			category: expense.category,
			date: expense.date
		});

		return { success: true };
	},

	updateStatus: async ({ locals, request }) => {
		await requirePermission(locals, 'finances.expenses', 'update');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;
		const status = formData.get('status') as string;

		if (!idStr || !status) {
			return fail(400, { error: 'Expense ID and status are required' });
		}
		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid expense ID' });
		}

		const expense = await prisma.expense.findFirst({
			where: { id, deletedAt: null },
			select: { id: true, status: true }
		});

		if (!expense) {
			return fail(404, { error: 'Expense not found' });
		}

		await prisma.expense.update({
			where: { id },
			data: { status }
		});

		await logUpdate(
			locals.user!.id,
			'finances.expenses',
			String(id),
			'Expense',
			{ status: expense.status },
			{ status }
		);

		return { success: true };
	}
};
