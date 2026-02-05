import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'finances.expenses', 'read');

	// Parse expense ID
	const expenseId = parseInt(params.id);
	if (isNaN(expenseId)) {
		error(400, 'Invalid expense ID');
	}

	const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;

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

	if (expense.deletedAt && !isAdmin) {
		error(403, 'Access denied');
	}

	// Convert Decimal fields to numbers for serialization
	return {
		expense: {
			...expense,
			amount: Number(expense.amount),
			payment: expense.payment ? {
				...expense.payment,
				amount: Number(expense.payment.amount)
			} : null,
			isDeleted: expense.deletedAt !== null
		},
		isAdmin
	};
};
