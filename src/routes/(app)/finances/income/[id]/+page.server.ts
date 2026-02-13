import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { error } from '@sveltejs/kit';
import { parseId } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'finances.income', 'read');

	const incomeId = parseId(params.id, 'income');

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

	// Convert Decimal fields to numbers for serialization
	return {
		income: {
			...income,
			amount: Number(income.amount),
			tax: Number(income.tax),
			tax_value: Number(income.tax_value),
			taxRate: income.taxRate ? Number(income.taxRate) : null,
			payment: income.payment ? {
				...income.payment,
				amount: Number(income.payment.amount)
			} : null
		}
	};
};
