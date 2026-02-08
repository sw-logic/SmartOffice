import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete, logUpdate } from '$lib/server/audit';
import { promoteProjectedRecords } from '$lib/server/recurring';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'finances.income', 'read');

	const isAdmin = checkPermission(locals, '*', '*');

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
			gte: startDate,
			lte: endDate
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
			invoiceReference: true,
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
			amount: true,
			tax_value: true
		},
		_count: true
	});

	// Get clients for filter dropdown
	const clients = await prisma.client.findMany({
		where: { deletedAt: null },
		select: { id: true, name: true, paymentTerms: true },
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
		tax: Number(inc.tax),
		tax_value: Number(inc.tax_value)
	}));

	// Load data needed for the form modal
	const projects = await prisma.project.findMany({
		where: { deletedAt: null, status: { in: ['planning', 'active'] } },
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
				where: { date: ytdDateFilter, deletedAt: null },
				_sum: { amount: true }
			}),
			prisma.expense.aggregate({
				where: { date: ytdDateFilter, deletedAt: null },
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
		incomes: serializedIncomes,
		clients,
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
				date: true,
				isRecurring: true,
				parentId: true
			}
		});

		if (!income) {
			return fail(404, { error: 'Income not found' });
		}

		const now = new Date();

		await prisma.income.update({
			where: { id },
			data: { deletedAt: now }
		});

		// If this is a recurring parent, also delete all projected children
		if (income.isRecurring && !income.parentId) {
			await prisma.income.updateMany({
				where: {
					parentId: id,
					status: 'projected',
					deletedAt: null
				},
				data: { deletedAt: now }
			});
		}

		await logDelete(locals.user!.id, 'finances.income', String(id), 'Income', {
			amount: income.amount,
			description: income.description,
			category: income.category,
			date: income.date
		});

		return { success: true };
	},

	bulkDelete: async ({ locals, request }) => {
		await requirePermission(locals, 'finances.income', 'delete');

		const formData = await request.formData();
		const idsStr = formData.get('ids') as string;

		if (!idsStr) {
			return fail(400, { error: 'Income IDs are required' });
		}

		const ids = idsStr.split(',').map(Number).filter(id => !isNaN(id));
		if (ids.length === 0) {
			return fail(400, { error: 'No valid income IDs provided' });
		}

		const incomes = await prisma.income.findMany({
			where: {
				id: { in: ids },
				deletedAt: null
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

		if (incomes.length === 0) {
			return fail(404, { error: 'No income records found' });
		}

		const now = new Date();

		// Soft delete all selected incomes
		await prisma.income.updateMany({
			where: { id: { in: incomes.map(i => i.id) } },
			data: { deletedAt: now }
		});

		// For recurring parents, also delete projected children
		const recurringParentIds = incomes
			.filter(i => i.isRecurring && !i.parentId)
			.map(i => i.id);

		if (recurringParentIds.length > 0) {
			await prisma.income.updateMany({
				where: {
					parentId: { in: recurringParentIds },
					status: 'projected',
					deletedAt: null
				},
				data: { deletedAt: now }
			});
		}

		for (const income of incomes) {
			await logDelete(locals.user!.id, 'finances.income', String(income.id), 'Income', {
				amount: income.amount,
				description: income.description,
				category: income.category,
				date: income.date
			});
		}

		return { success: true, count: incomes.length };
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
