import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'vendors', 'read');

	const search = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '10');
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
		// Default: show active vendors
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
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		},
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
	delete: async ({ locals, request }) => {
		await requirePermission(locals, 'vendors', 'delete');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Vendor ID is required' });
		}
		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid vendor ID' });
		}

		const vendor = await prisma.vendor.findUnique({
			where: { id },
			select: { id: true, name: true, companyName: true }
		});

		if (!vendor) {
			return fail(404, { error: 'Vendor not found' });
		}

		// Log before hard delete
		await logDelete(locals.user!.id, 'vendors', String(id), 'Vendor', {
			name: vendor.name,
			companyName: vendor.companyName
		});

		await prisma.vendor.delete({
			where: { id }
		});

		return { success: true };
	}
};
