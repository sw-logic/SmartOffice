import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { parseListParams, buildPagination, createDeleteAction } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'vendors', 'read');

	const { search, sortBy, sortOrder, page, limit } = parseListParams(url);
	const status = url.searchParams.get('status') || 'active';
	const category = url.searchParams.get('category') || '';

	// Build where clause
	type WhereClause = {
		status?: string;
		category?: string;
		OR?: Array<{
			name?: { contains: string; mode: 'insensitive' };
			companyName?: { contains: string; mode: 'insensitive' };
			email?: { contains: string; mode: 'insensitive' };
		}>;
	};

	let where: WhereClause = {};

	if (status === 'active' || status === 'inactive') {
		where.status = status;
	} else {
		where.status = 'active';
	}

	if (category) {
		where.category = category;
	}

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: 'insensitive' } },
			{ companyName: { contains: search, mode: 'insensitive' } },
			{ email: { contains: search, mode: 'insensitive' } }
		];
	}

	const [vendors, total, categories] = await Promise.all([
		prisma.vendor.findMany({
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
				category: true,
				createdAt: true,
				_count: {
					select: {
						expenses: true,
						contacts: true
					}
				}
			}
		}),
		prisma.vendor.count({ where }),
		// Get distinct categories for filter dropdown
		prisma.vendor.findMany({
			where: { category: { not: null } },
			select: { category: true },
			distinct: ['category']
		})
	]);

	return {
		vendors: vendors.map(vendor => ({
			...vendor,
			expenseCount: vendor._count.expenses,
			contactCount: vendor._count.contacts
		})),
		pagination: buildPagination(page, limit, total),
		filters: {
			search,
			sortBy,
			sortOrder,
			status,
			category
		},
		categories: categories.map(c => c.category).filter(Boolean) as string[]
	};
};

export const actions: Actions = {
	delete: createDeleteAction({
		permission: ['vendors', 'delete'],
		module: 'vendors',
		entityType: 'Vendor',
		model: 'vendor',
		findSelect: { id: true, name: true, companyName: true },
		auditValues: (record) => ({ name: record.name, companyName: record.companyName })
	})
};
