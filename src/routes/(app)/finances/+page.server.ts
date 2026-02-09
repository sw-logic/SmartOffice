import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { hasAnyPermission, checkPermission } from '$lib/server/access-control';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(303, '/login');
	}

	const canReadIncome = hasAnyPermission(locals, [
		{ module: 'finances.income', action: 'read' }
	]);
	const canReadExpenses = hasAnyPermission(locals, [
		{ module: 'finances.expenses', action: 'read' }
	]);
	const canViewSalary = checkPermission(locals, 'employees', 'salary');

	if (!canReadIncome && !canReadExpenses) {
		redirect(303, '/login?error=access_denied');
	}

	const now = new Date();
	const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()));
	const period = url.searchParams.get('period') || String(now.getMonth() + 1);

	// Calculate date range based on period
	let startDate: Date;
	let endDate: Date;
	let salaryMonths = 1;

	if (period === 'q1') {
		startDate = new Date(year, 0, 1);
		endDate = new Date(year, 3, 0, 23, 59, 59, 999);
		salaryMonths = 3;
	} else if (period === 'q2') {
		startDate = new Date(year, 3, 1);
		endDate = new Date(year, 6, 0, 23, 59, 59, 999);
		salaryMonths = 3;
	} else if (period === 'q3') {
		startDate = new Date(year, 6, 1);
		endDate = new Date(year, 9, 0, 23, 59, 59, 999);
		salaryMonths = 3;
	} else if (period === 'q4') {
		startDate = new Date(year, 9, 1);
		endDate = new Date(year, 12, 0, 23, 59, 59, 999);
		salaryMonths = 3;
	} else if (period === 'year') {
		startDate = new Date(year, 0, 1);
		endDate = new Date(year, 12, 0, 23, 59, 59, 999);
		salaryMonths = 12;
	} else {
		const month = parseInt(period) || (now.getMonth() + 1);
		startDate = new Date(year, month - 1, 1);
		endDate = new Date(year, month, 0, 23, 59, 59, 999);
	}

	const dateFilter = { gte: startDate, lte: endDate };

	const incomeWhere = { date: dateFilter };
	const expenseWhere = { date: dateFilter };

	const [incomes, expenses, employees, incomeAgg, expenseAgg] = await Promise.all([
		canReadIncome
			? prisma.income.findMany({
					where: incomeWhere,
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
						isRecurring: true,
						recurringPeriod: true,
						clientName: true,
						client: { select: { id: true, name: true } }
					},
					orderBy: { date: 'desc' }
				})
			: [],
		canReadExpenses
			? prisma.expense.findMany({
					where: expenseWhere,
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
						isRecurring: true,
						recurringPeriod: true,
						vendorName: true,
						vendor: { select: { id: true, name: true } }
					},
					orderBy: { date: 'desc' }
				})
			: [],
		canViewSalary
			? prisma.user.findMany({
					where: {
						employeeStatus: 'active',
						salary: { not: null, gt: 0 }
					},
					select: {
						id: true,
						firstName: true,
						lastName: true,
						salary: true,
						salary_tax: true,
						salary_bonus: true,
						jobTitle: true,
						department: true
					}
				})
			: [],
		canReadIncome
			? prisma.income.aggregate({
					where: incomeWhere,
					_sum: { amount: true, tax_value: true },
					_count: true
				})
			: null,
		canReadExpenses
			? prisma.expense.aggregate({
					where: expenseWhere,
					_sum: { amount: true, tax_value: true },
					_count: true
				})
			: null
	]);

	// Serialize Decimal fields
	const serializedIncomes = incomes.map((inc) => ({
		...inc,
		amount: Number(inc.amount),
		tax: Number(inc.tax),
		tax_value: Number(inc.tax_value)
	}));

	const serializedExpenses = expenses.map((exp) => ({
		...exp,
		amount: Number(exp.amount),
		tax: Number(exp.tax),
		tax_value: Number(exp.tax_value)
	}));

	const serializedEmployees = employees.map((emp) => ({
		...emp,
		salary: Number(emp.salary ?? 0),
		salary_tax: Number(emp.salary_tax ?? 0),
		salary_bonus: Number(emp.salary_bonus ?? 0)
	}));

	// Calculate employee totals (multiply by number of months in period)
	let totalSalary = 0;
	let totalSalaryTax = 0;
	let totalSalaryBonus = 0;
	for (const emp of serializedEmployees) {
		totalSalary += emp.salary * salaryMonths;
		totalSalaryTax += emp.salary_tax * salaryMonths;
		totalSalaryBonus += emp.salary_bonus * salaryMonths;
	}

	const totalIncome = incomeAgg?._sum.amount ? Number(incomeAgg._sum.amount) : 0;
	const totalIncomeTax = incomeAgg?._sum.tax_value ? Number(incomeAgg._sum.tax_value) : 0;
	const totalExpenses = expenseAgg?._sum.amount ? Number(expenseAgg._sum.amount) : 0;
	const totalExpensesTax = expenseAgg?._sum.tax_value ? Number(expenseAgg._sum.tax_value) : 0;
	const totalEmployeeCost = totalSalary + totalSalaryTax + totalSalaryBonus;
	const balance = totalIncome - (totalExpenses + totalEmployeeCost);

	return {
		year,
		period,
		incomes: serializedIncomes,
		expenses: serializedExpenses,
		employees: serializedEmployees,
		canViewSalary,
		summary: {
			totalIncome,
			totalIncomeTax,
			incomeCount: incomeAgg?._count ?? 0,
			totalExpenses,
			totalExpensesTax,
			expenseCount: expenseAgg?._count ?? 0,
			totalSalary,
			totalSalaryTax,
			totalSalaryBonus,
			totalEmployeeCost,
			balance
		}
	};
};
