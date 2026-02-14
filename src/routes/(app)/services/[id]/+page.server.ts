import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { parseId, createDeleteAction, serializeDecimals } from '$lib/server/crud-helpers';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'services', 'read');

	const serviceId = parseId(params.id, 'service');

	const service = await prisma.service.findUnique({
		where: { id: serviceId },
		include: {
			client: { select: { id: true, name: true } },
			contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, position: true } },
			assignedTo: { select: { id: true, name: true, firstName: true, lastName: true, image: true } },
			createdBy: { select: { id: true, name: true } },
			timeRecords: {
				orderBy: { date: 'desc' },
				take: 50,
				select: {
					id: true,
					date: true,
					minutes: true,
					description: true,
					type: true,
					category: true,
					billable: true,
					userId: true,
					user: { select: { id: true, firstName: true, lastName: true } },
					createdById: true,
					createdBy: { select: { id: true, name: true } },
					createdAt: true
				}
			}
		}
	});

	if (!service) {
		error(404, 'Service not found');
	}

	// Current month spent time
	const now = new Date();
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
	const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

	const monthlySpent = await prisma.timeRecord.aggregate({
		where: {
			serviceId,
			date: { gte: monthStart, lte: monthEnd }
		},
		_sum: { minutes: true }
	});

	// Employees for time record form
	const employees = await prisma.user.findMany({
		where: { employeeStatus: 'active' },
		orderBy: { name: 'asc' },
		select: { id: true, firstName: true, lastName: true }
	});

	return {
		service: serializeDecimals(service, ['monthlyFee', 'taxRate']),
		monthlySpentMinutes: monthlySpent._sum.minutes ?? 0,
		employees,
		canUpdate: checkPermission(locals, 'services', 'update'),
		canDelete: checkPermission(locals, 'services', 'delete')
	};
};

export const actions: Actions = {
	delete: createDeleteAction({
		permission: ['services', 'delete'],
		module: 'services',
		entityType: 'Service',
		model: 'service',
		findSelect: { id: true, name: true, clientName: true, incomeId: true },
		auditValues: (record) => ({ name: record.name, clientName: record.clientName }),
		beforeDelete: async (record) => {
			if (record.incomeId) {
				await prisma.income.delete({ where: { id: record.incomeId } }).catch(() => {});
			}
		}
	})
};
