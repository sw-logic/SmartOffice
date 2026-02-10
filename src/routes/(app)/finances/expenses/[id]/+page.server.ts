import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { error } from '@sveltejs/kit';
import { parseId } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'finances.expenses', 'read');

	const expenseId = parseId(params.id, 'expense');

	const expense = await prisma.expense.findUnique({
		where: { id: expenseId },
		include: {
			vendor: {
				select: {
					id: true,
					name: true,
					email: true
				}
			},
			project: {
				select: {
					id: true,
					name: true,
					client: {
						select: {
							id: true,
							name: true
						}
					}
				}
			},
			payment: {
				select: {
					id: true,
					amount: true,
					date: true,
					status: true,
					method: true
				}
			},
			createdBy: {
				select: {
					id: true,
					name: true
				}
			}
		}
	});

	if (!expense) {
		error(404, 'Expense not found');
	}

	// Convert Decimal fields to numbers for serialization
	return {
		expense: {
			...expense,
			amount: Number(expense.amount),
			payment: expense.payment ? {
				...expense.payment,
				amount: Number(expense.payment.amount)
			} : null
		}
	};
};
