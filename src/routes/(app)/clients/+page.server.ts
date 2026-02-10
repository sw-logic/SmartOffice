import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { parseListParams, buildPagination, createDeleteAction } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'clients', 'read');

	const { search, sortBy, sortOrder, page, limit } = parseListParams(url);
	const status = url.searchParams.get('status') || 'active';

	// Build where clause based on status filter
	type WhereClause = {
		status?: string;
		OR?: Array<{
			name?: { contains: string; mode: 'insensitive' };
			companyName?: { contains: string; mode: 'insensitive' };
			email?: { contains: string; mode: 'insensitive' };
		}>;
	};

	let where: WhereClause = {};

	if (status === 'active' || status === 'inactive' || status === 'archived') {
		where.status = status;
	} else {
		where.status = 'active';
	}

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: 'insensitive' } },
			{ companyName: { contains: search, mode: 'insensitive' } },
			{ email: { contains: search, mode: 'insensitive' } }
		];
	}

	const [clients, total] = await Promise.all([
		prisma.client.findMany({
			where,
			orderBy: { [sortBy]: sortOrder },
			skip: (page - 1) * limit,
			take: limit,
			select: {
				id: true,
				name: true,
				companyName: true,
				email: true,
				phone: true,
				city: true,
				country: true,
				status: true,
				industry: true,
				createdAt: true,
				_count: {
					select: {
						projects: true,
						contacts: true
					}
				}
			}
		}),
		prisma.client.count({ where })
	]);

	return {
		clients: clients.map(client => ({
			...client,
			projectCount: client._count.projects,
			contactCount: client._count.contacts
		})),
		pagination: buildPagination(page, limit, total),
		filters: {
			search,
			sortBy,
			sortOrder,
			status
		}
	};
};

export const actions: Actions = {
	delete: createDeleteAction({
		permission: ['clients', 'delete'],
		module: 'clients',
		entityType: 'Client',
		model: 'client',
		findSelect: { id: true, name: true, companyName: true },
		auditValues: (record) => ({ name: record.name, companyName: record.companyName })
	})
};
