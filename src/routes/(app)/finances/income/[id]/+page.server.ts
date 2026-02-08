import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'finances.income', 'read');

	// Parse income ID
	const incomeId = parseInt(params.id);
	if (isNaN(incomeId)) {
		error(400, 'Invalid income ID');
	}

	const isAdmin = checkPermission(locals, '*', '*');

	const income = await prisma.income.findUnique({
		where: { id: incomeId },
		include: {
			client: {
				select: {
					id: true,
					name: true,
					email: true
				}
			},
			project: {
				select: {
					id: true,
					name: true
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

	if (!income) {
		error(404, 'Income not found');
	}

	if (income.deletedAt && !isAdmin) {
		error(403, 'Access denied');
	}

	// Convert Decimal fields to numbers for serialization
	return {
		income: {
			...income,
			amount: Number(income.amount),
			taxRate: income.taxRate ? Number(income.taxRate) : null,
			payment: income.payment ? {
				...income.payment,
				amount: Number(income.payment.amount)
			} : null,
			isDeleted: income.deletedAt !== null
		},
		isAdmin
	};
};
