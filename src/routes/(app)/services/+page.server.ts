import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { parseListParams, buildPagination, serializeDecimals, createDeleteAction, createBulkDeleteAction } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'services', 'read');

	const { search, sortBy, sortOrder, page, limit } = parseListParams(url, {
		sortBy: 'name',
		sortOrder: 'asc'
	});

	type WhereClause = {
		status?: string;
		OR?: Array<{
			name?: { contains: string; mode: 'insensitive' };
			clientName?: { contains: string; mode: 'insensitive' };
		}>;
	};

	let where: WhereClause = {};

	const statusFilter = url.searchParams.get('status') || '';
	if (statusFilter) {
		where.status = statusFilter;
	}

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: 'insensitive' } },
			{ clientName: { contains: search, mode: 'insensitive' } }
		];
	}

	const [services, total] = await Promise.all([
		prisma.service.findMany({
			where,
			orderBy: { [sortBy]: sortOrder },
			skip: (page - 1) * limit,
			take: limit,
			select: {
				id: true,
				name: true,
				type: true,
				status: true,
				monthlyFee: true,
				currency: true,
				budgetedHours: true,
				spentTime: true,
				startDate: true,
				endDate: true,
				clientId: true,
				clientName: true,
				client: { select: { id: true, name: true } },
				assignedTo: { select: { id: true, name: true, firstName: true, lastName: true } },
				_count: { select: { timeRecords: true } }
			}
		}),
		prisma.service.count({ where })
	]);

	return {
		services: services.map((s) => serializeDecimals(s, ['monthlyFee'])),
		pagination: buildPagination(page, limit, total),
		filters: { search, sortBy, sortOrder, status: statusFilter },
		canCreate: checkPermission(locals, 'services', 'create'),
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
			// Delete linked recurring Income parent (cascade deletes projected children)
			if (record.incomeId) {
				await prisma.income.delete({ where: { id: record.incomeId } }).catch(() => {});
			}
		}
	}),
	bulkDelete: createBulkDeleteAction({
		permission: ['services', 'delete'],
		module: 'services',
		entityType: 'Service',
		model: 'service',
		findSelect: { id: true, name: true, clientName: true, incomeId: true },
		auditValues: (record) => ({ name: record.name, clientName: record.clientName }),
		beforeDelete: async (records) => {
			const incomeIds = records.map((r) => r.incomeId).filter(Boolean) as number[];
			if (incomeIds.length > 0) {
				await prisma.income.deleteMany({ where: { id: { in: incomeIds } } });
			}
		}
	})
};
