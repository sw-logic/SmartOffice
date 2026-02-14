import { prisma } from './prisma';

/**
 * Generate occurrence dates for a recurring schedule.
 * Returns all dates AFTER startDate up to and including endDate.
 */
export function generateOccurrenceDates(
	startDate: Date,
	period: string,
	endDate: Date
): Date[] {
	const dates: Date[] = [];
	const anchorDay = startDate.getDate();
	const anchorMonth = startDate.getMonth();

	let current = new Date(startDate);

	// Advance to the first occurrence after startDate
	advanceDate(current, period, anchorDay, anchorMonth);

	while (current <= endDate) {
		dates.push(new Date(current));
		advanceDate(current, period, anchorDay, anchorMonth);
	}

	return dates;
}

function advanceDate(date: Date, period: string, anchorDay: number, anchorMonth: number) {
	switch (period) {
		case 'weekly':
			date.setDate(date.getDate() + 7);
			break;
		case 'biweekly':
			date.setDate(date.getDate() + 14);
			break;
		case 'monthly': {
			const nextMonth = date.getMonth() + 1;
			const nextYear = date.getFullYear() + (nextMonth > 11 ? 1 : 0);
			const actualMonth = nextMonth % 12;
			// Clamp to last day of month if anchorDay exceeds month length
			const daysInMonth = new Date(nextYear, actualMonth + 1, 0).getDate();
			date.setFullYear(nextYear, actualMonth, Math.min(anchorDay, daysInMonth));
			break;
		}
		case 'quarterly': {
			const qMonth = date.getMonth() + 3;
			const qYear = date.getFullYear() + Math.floor(qMonth / 12);
			const qActualMonth = qMonth % 12;
			const qDaysInMonth = new Date(qYear, qActualMonth + 1, 0).getDate();
			date.setFullYear(qYear, qActualMonth, Math.min(anchorDay, qDaysInMonth));
			break;
		}
		case 'yearly': {
			const yYear = date.getFullYear() + 1;
			const yDaysInMonth = new Date(yYear, anchorMonth + 1, 0).getDate();
			date.setFullYear(yYear, anchorMonth, Math.min(anchorDay, yDaysInMonth));
			break;
		}
	}
}

/**
 * Generate projected income occurrences for a recurring parent.
 * Deletes existing projected children, then bulk creates new ones.
 * Returns the count of generated records.
 */
export async function generateIncomeOccurrences(
	parentId: number,
	userId: number
): Promise<number> {
	const parent = await prisma.income.findUnique({
		where: { id: parentId }
	});

	if (!parent || !parent.isRecurring || !parent.recurringPeriod || !parent.recurringEndDate) {
		return 0;
	}

	// Delete existing projected children
	await prisma.income.deleteMany({
		where: {
			parentId,
			status: 'projected'
		}
	});

	const dates = generateOccurrenceDates(
		parent.date,
		parent.recurringPeriod,
		parent.recurringEndDate
	);

	if (dates.length === 0) return 0;

	const records = dates.map((date) => ({
		amount: parent.amount,
		tax: parent.tax,
		tax_value: parent.tax_value,
		currency: parent.currency,
		date,
		description: parent.description,
		category: parent.category,
		status: 'projected',
		paymentTermDays: parent.paymentTermDays,
		dueDate: parent.paymentTermDays ? new Date(date.getTime() + parent.paymentTermDays * 86400000) : null,
		isRecurring: false,
		recurringPeriod: null as string | null,
		recurringEndDate: null as Date | null,
		parentId: parent.id,
		clientId: parent.clientId,
		clientName: parent.clientName,
		projectId: parent.projectId,
		invoiceReference: parent.invoiceReference,
		taxRate: parent.taxRate,
		notes: parent.notes,
		createdById: userId
	}));

	await prisma.income.createMany({ data: records });

	return dates.length;
}

/**
 * Generate projected expense occurrences for a recurring parent.
 * Deletes existing projected children, then bulk creates new ones.
 * Returns the count of generated records.
 */
export async function generateExpenseOccurrences(
	parentId: number,
	userId: number
): Promise<number> {
	const parent = await prisma.expense.findUnique({
		where: { id: parentId }
	});

	if (!parent || !parent.isRecurring || !parent.recurringPeriod || !parent.recurringEndDate) {
		return 0;
	}

	// Delete existing projected children
	await prisma.expense.deleteMany({
		where: {
			parentId,
			status: 'projected'
		}
	});

	const dates = generateOccurrenceDates(
		parent.date,
		parent.recurringPeriod,
		parent.recurringEndDate
	);

	if (dates.length === 0) return 0;

	const records = dates.map((date) => ({
		amount: parent.amount,
		tax: parent.tax,
		tax_value: parent.tax_value,
		currency: parent.currency,
		date,
		description: parent.description,
		category: parent.category,
		status: 'projected',
		paymentTermDays: parent.paymentTermDays,
		dueDate: parent.paymentTermDays ? new Date(date.getTime() + parent.paymentTermDays * 86400000) : null,
		isRecurring: false,
		recurringPeriod: null as string | null,
		recurringEndDate: null as Date | null,
		parentId: parent.id,
		vendorId: parent.vendorId,
		vendorName: parent.vendorName,
		projectId: parent.projectId,
		receiptPath: null as string | null,
		notes: parent.notes,
		createdById: userId
	}));

	await prisma.expense.createMany({ data: records });

	return dates.length;
}

/**
 * Generate a recurring Income parent linked to a service.
 * Creates the Income with monthly recurring settings, then generates projected children.
 * Returns the parent Income ID (to be stored in service.incomeId).
 */
export async function generateServiceIncome(
	service: {
		id: number;
		name: string;
		monthlyFee: unknown;
		currency: string;
		recurringPeriod: string;
		taxRate: number | null;
		clientId: number | null;
		clientName: string | null;
		startDate: Date;
		endDate: Date | null;
	},
	userId: number
): Promise<number> {
	const amount = Number(service.monthlyFee);
	const taxRate = service.taxRate ?? 0;
	const tax_value = taxRate > 0 ? Math.round(amount * taxRate) / 100 : 0;

	const income = await prisma.income.create({
		data: {
			amount,
			tax: tax_value,
			tax_value,
			taxRate: taxRate > 0 ? taxRate : null,
			currency: service.currency,
			date: service.startDate,
			description: service.name,
			category: 'subscription',
			status: 'pending',
			isRecurring: true,
			recurringPeriod: service.recurringPeriod,
			recurringEndDate: service.endDate,
			clientId: service.clientId,
			clientName: service.clientName,
			createdById: userId
		}
	});

	if (service.endDate) {
		await generateIncomeOccurrences(income.id, userId);
	}

	return income.id;
}

/**
 * Promote projected records whose date has arrived to 'pending' status.
 * Call this on page load or via a cron job.
 */
export async function promoteProjectedRecords(): Promise<{ income: number; expenses: number }> {
	const today = new Date();
	today.setHours(23, 59, 59, 999);

	const [incomeResult, expenseResult] = await Promise.all([
		prisma.income.updateMany({
			where: {
				status: 'projected',
				date: { lte: today }
			},
			data: { status: 'pending' }
		}),
		prisma.expense.updateMany({
			where: {
				status: 'projected',
				date: { lte: today }
			},
			data: { status: 'pending' }
		})
	]);

	return {
		income: incomeResult.count,
		expenses: expenseResult.count
	};
}
