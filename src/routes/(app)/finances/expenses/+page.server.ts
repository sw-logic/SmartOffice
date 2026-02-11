import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';
import { promoteProjectedRecords } from '$lib/server/recurring';
import {
	parseListParams,
	parseDateRange,
	serializeDecimals,
	createDeleteAction,
	createBulkDeleteAction,
	parseFormId
} from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'finances.expenses', 'read');

	// Promote projected records whose date has arrived
	await promoteProjectedRecords();

	const { year, period, startDate, endDate } = parseDateRange(url);

	// Other filters
	const { search, sortBy, sortOrder, page, limit } = parseListParams(url, { sortBy: 'date', sortOrder: 'desc', limit: 50 });
	const status = url.searchParams.get('status') || '';
	const category = url.searchParams.get('category') || '';
	const vendorId = url.searchParams.get('vendorId') || '';
	const isRecurring = url.searchParams.get('isRecurring') || '';

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
		skip: (page - 1) * limit,
		take: limit
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
	const serializedExpenses = expenses.map(exp => serializeDecimals(exp, ['amount', 'tax', 'tax_value']));

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
		pageSize: limit,
		totalPages: Math.ceil(totalCount / limit),
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

const expenseFindSelect = {
	id: true, amount: true, description: true, category: true,
	date: true, isRecurring: true, parentId: true
};
const expenseAuditValues = (record: any) => ({
	amount: record.amount,
	description: record.description,
	category: record.category,
	date: record.date
});

async function deleteProjectedChildren(records: any[]) {
	const recurringParentIds = records
		.filter((r: any) => r.isRecurring && !r.parentId)
		.map((r: any) => r.id);

	if (recurringParentIds.length > 0) {
		await prisma.expense.deleteMany({
			where: {
				parentId: { in: recurringParentIds },
				status: 'projected'
			}
		});
	}
}

export const actions: Actions = {
	delete: createDeleteAction({
		permission: ['finances.expenses', 'delete'],
		module: 'finances.expenses',
		entityType: 'Expense',
		model: 'expense',
		findSelect: expenseFindSelect,
		auditValues: expenseAuditValues,
		beforeDelete: async (record) => {
			if (record.isRecurring && !record.parentId) {
				await prisma.expense.deleteMany({
					where: { parentId: record.id, status: 'projected' }
				});
			}
		}
	}),

	bulkDelete: createBulkDeleteAction({
		permission: ['finances.expenses', 'delete'],
		module: 'finances.expenses',
		entityType: 'Expense',
		model: 'expense',
		findSelect: expenseFindSelect,
		auditValues: expenseAuditValues,
		beforeDelete: deleteProjectedChildren
	}),

	updateStatus: async ({ locals, request }) => {
		await requirePermission(locals, 'finances.expenses', 'update');

		const formData = await request.formData();
		const result = parseFormId(formData, 'id', 'Expense');
		if ('error' in result) return result.error;
		const { id } = result;

		const status = formData.get('status') as string;
		if (!status) {
			return fail(400, { error: 'Expense ID and status are required' });
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
