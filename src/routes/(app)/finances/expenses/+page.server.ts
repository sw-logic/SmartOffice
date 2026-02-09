import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete, logUpdate } from '$lib/server/audit';
import { promoteProjectedRecords } from '$lib/server/recurring';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'finances.expenses', 'read');

	// Promote projected records whose date has arrived
	await promoteProjectedRecords();

	// Parse year/period parameters (same pattern as dashboard)
	const now = new Date();
	const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()));
	const period = url.searchParams.get('period') || String(now.getMonth() + 1);

	// Calculate date range based on period
	let startDate: Date;
	let endDate: Date;

	if (period === 'q1') {
		startDate = new Date(year, 0, 1);
		endDate = new Date(year, 3, 0, 23, 59, 59, 999);
	} else if (period === 'q2') {
		startDate = new Date(year, 3, 1);
		endDate = new Date(year, 6, 0, 23, 59, 59, 999);
	} else if (period === 'q3') {
		startDate = new Date(year, 6, 1);
		endDate = new Date(year, 9, 0, 23, 59, 59, 999);
	} else if (period === 'q4') {
		startDate = new Date(year, 9, 1);
		endDate = new Date(year, 12, 0, 23, 59, 59, 999);
	} else if (period === 'year') {
		startDate = new Date(year, 0, 1);
		endDate = new Date(year, 12, 0, 23, 59, 59, 999);
	} else {
		const month = parseInt(period) || (now.getMonth() + 1);
		startDate = new Date(year, month - 1, 1);
		endDate = new Date(year, month, 0, 23, 59, 59, 999);
	}

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
		date: {
			gte: startDate,
			lte: endDate
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
			receiptPath: true,
			notes: true,
			vendorName: true,
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
			amount: true,
			tax_value: true
		},
		_count: true
	});

	// Get vendors for filter dropdown
	const vendors = await prisma.vendor.findMany({
		select: { id: true, name: true, paymentTerms: true },
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
		amount: Number(exp.amount),
		tax: Number(exp.tax),
		tax_value: Number(exp.tax_value)
	}));

	// Load data needed for the form modal
	const projects = await prisma.project.findMany({
		where: { status: { in: ['planning', 'active'] } },
		select: {
			id: true,
			name: true,
			client: { select: { id: true, name: true } }
		},
		orderBy: { name: 'asc' }
	});

	// Cumulative YTD balance (only for month periods)
	const monthNum = parseInt(period);
	const isMonthPeriod = monthNum >= 1 && monthNum <= 12;
	let cumulativeBalance: { income: number; expenses: number; balance: number } | null = null;

	if (isMonthPeriod) {
		const ytdStart = new Date(year, 0, 1);
		const ytdEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);
		const ytdDateFilter = { gte: ytdStart, lte: ytdEnd };

		const [ytdIncome, ytdExpenses] = await Promise.all([
			prisma.income.aggregate({
				where: { date: ytdDateFilter },
				_sum: { amount: true }
			}),
			prisma.expense.aggregate({
				where: { date: ytdDateFilter },
				_sum: { amount: true }
			})
		]);

		const cumIncome = ytdIncome._sum.amount ? Number(ytdIncome._sum.amount) : 0;
		const cumExpenses = ytdExpenses._sum.amount ? Number(ytdExpenses._sum.amount) : 0;
		cumulativeBalance = {
			income: cumIncome,
			expenses: cumExpenses,
			balance: cumIncome - cumExpenses
		};
	}

	return {
		expenses: serializedExpenses,
		vendors,
		categories,
		projects,
		year,
		period,
		cumulativeBalance,
		summary: {
			totalAmount: summaryData._sum.amount ? Number(summaryData._sum.amount) : 0,
			totalTaxValue: summaryData._sum.tax_value ? Number(summaryData._sum.tax_value) : 0,
			count: summaryData._count
		},
		totalCount,
		page,
		pageSize,
		totalPages: Math.ceil(totalCount / pageSize),
		filters: {
			search,
			status,
			category,
			vendorId,
			isRecurring,
			sortBy,
			sortOrder
		}
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

		const expense = await prisma.expense.findUnique({
			where: { id },
			select: {
				id: true,
				amount: true,
				description: true,
				category: true,
				date: true,
				isRecurring: true,
				parentId: true
			}
		});

		if (!expense) {
			return fail(404, { error: 'Expense not found' });
		}

		// Log BEFORE hard delete
		await logDelete(locals.user!.id, 'finances.expenses', String(id), 'Expense', {
			amount: expense.amount,
			description: expense.description,
			category: expense.category,
			date: expense.date
		});

		// If this is a recurring parent, also delete all projected children
		if (expense.isRecurring && !expense.parentId) {
			await prisma.expense.deleteMany({
				where: {
					parentId: id,
					status: 'projected'
				}
			});
		}

		await prisma.expense.delete({
			where: { id }
		});

		return { success: true };
	},

	bulkDelete: async ({ locals, request }) => {
		await requirePermission(locals, 'finances.expenses', 'delete');

		const formData = await request.formData();
		const idsStr = formData.get('ids') as string;

		if (!idsStr) {
			return fail(400, { error: 'Expense IDs are required' });
		}

		const ids = idsStr.split(',').map(Number).filter(id => !isNaN(id));
		if (ids.length === 0) {
			return fail(400, { error: 'No valid expense IDs provided' });
		}

		const expenses = await prisma.expense.findMany({
			where: {
				id: { in: ids }
			},
			select: {
				id: true,
				amount: true,
				description: true,
				category: true,
				date: true,
				isRecurring: true,
				parentId: true
			}
		});

		if (expenses.length === 0) {
			return fail(404, { error: 'No expense records found' });
		}

		// Log BEFORE hard delete
		for (const expense of expenses) {
			await logDelete(locals.user!.id, 'finances.expenses', String(expense.id), 'Expense', {
				amount: expense.amount,
				description: expense.description,
				category: expense.category,
				date: expense.date
			});
		}

		// For recurring parents, also delete projected children
		const recurringParentIds = expenses
			.filter(e => e.isRecurring && !e.parentId)
			.map(e => e.id);

		if (recurringParentIds.length > 0) {
			await prisma.expense.deleteMany({
				where: {
					parentId: { in: recurringParentIds },
					status: 'projected'
				}
			});
		}

		// Hard delete all selected expenses
		await prisma.expense.deleteMany({
			where: { id: { in: expenses.map(e => e.id) } }
		});

		return { success: true, count: expenses.length };
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

		const expense = await prisma.expense.findUnique({
			where: { id },
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
