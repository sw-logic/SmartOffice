import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete, logUpdate } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'pricelists', 'read');

	const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;

	// Get query parameters
	const search = url.searchParams.get('search') || '';
	const category = url.searchParams.get('category') || '';
	const active = url.searchParams.get('active') || 'true';
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = url.searchParams.get('sortOrder') || 'asc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = 50;

	// Build where clause
	const where: any = {};

	// Handle active/deleted filter
	if (active === 'deleted' && isAdmin) {
		where.deletedAt = { not: null };
	} else if (active === 'false') {
		where.deletedAt = null;
		where.active = false;
	} else if (active === 'true') {
		where.deletedAt = null;
		where.active = true;
	} else {
		// 'all' - show all non-deleted
		where.deletedAt = null;
	}

	// Search filter
	if (search) {
		where.OR = [
			{ name: { contains: search, mode: 'insensitive' } },
			{ description: { contains: search, mode: 'insensitive' } },
			{ sku: { contains: search, mode: 'insensitive' } }
		];
	}

	// Category filter
	if (category) {
		where.category = category;
	}

	// Build orderBy
	const orderBy: any = {};
	orderBy[sortBy] = sortOrder;

	// Get total count
	const totalCount = await prisma.priceListItem.count({ where });

	// Get price list items
	const itemsRaw = await prisma.priceListItem.findMany({
		where,
		select: {
			id: true,
			name: true,
			description: true,
			sku: true,
			category: true,
			unitPrice: true,
			currency: true,
			unitOfMeasure: true,
			taxRate: true,
			active: true,
			validFrom: true,
			validTo: true,
			deletedAt: true,
			_count: {
				select: {
					offerItems: true
				}
			}
		},
		orderBy,
		skip: (page - 1) * pageSize,
		take: pageSize
	});

	// Convert Decimal fields to numbers for serialization
	const items = itemsRaw.map((item) => ({
		...item,
		unitPrice: Number(item.unitPrice),
		taxRate: item.taxRate ? Number(item.taxRate) : null
	}));

	// Get distinct categories for filter
	const categoriesRaw = await prisma.priceListItem.findMany({
		where: {
			category: { not: null },
			deletedAt: null
		},
		select: { category: true },
		distinct: ['category']
	});
	const existingCategories = categoriesRaw
		.map((c) => c.category)
		.filter((c): c is string => c !== null)
		.sort();

	// Predefined categories
	const defaultCategories = [
		'Hourly rate',
		'Account',
		'Consulting',
		'Design',
		'Development',
		'Hosting',
		'Marketing',
		'Planning',
		'Project management',
		'SEO',
		'Site-build',
		'Support',
		'UX',
		'WordPress'
	];

	// Merge and deduplicate categories
	const categories = [...new Set([...defaultCategories, ...existingCategories])].sort();

	return {
		items,
		categories,
		totalCount,
		page,
		pageSize,
		totalPages: Math.ceil(totalCount / pageSize),
		filters: {
			search,
			category,
			active,
			sortBy,
			sortOrder
		},
		isAdmin
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		await requirePermission(locals, 'pricelists', 'delete');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Item ID is required' });
		}
		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid item ID' });
		}

		const item = await prisma.priceListItem.findFirst({
			where: { id, deletedAt: null },
			select: {
				id: true,
				name: true,
				sku: true,
				unitPrice: true
			}
		});

		if (!item) {
			return fail(404, { error: 'Item not found' });
		}

		// Soft delete
		await prisma.priceListItem.update({
			where: { id },
			data: { deletedAt: new Date() }
		});

		await logDelete(locals.user!.id, 'pricelists', String(id), 'PriceListItem', {
			name: item.name,
			sku: item.sku,
			unitPrice: Number(item.unitPrice)
		});

		return { success: true };
	},

	restore: async ({ locals, request }) => {
		await requirePermission(locals, 'pricelists', 'update');

		const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;
		if (!isAdmin) {
			return fail(403, { error: 'Only administrators can restore deleted items' });
		}

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Item ID is required' });
		}
		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid item ID' });
		}

		const item = await prisma.priceListItem.findFirst({
			where: { id, deletedAt: { not: null } }
		});

		if (!item) {
			return fail(404, { error: 'Deleted item not found' });
		}

		await prisma.priceListItem.update({
			where: { id },
			data: { deletedAt: null }
		});

		await logUpdate(
			locals.user!.id,
			'pricelists',
			String(id),
			'PriceListItem',
			{ deletedAt: item.deletedAt },
			{ deletedAt: null }
		);

		return { success: true };
	},

	toggleActive: async ({ locals, request }) => {
		await requirePermission(locals, 'pricelists', 'update');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;
		const active = formData.get('active') === 'true';

		if (!idStr) {
			return fail(400, { error: 'Item ID is required' });
		}
		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid item ID' });
		}

		const item = await prisma.priceListItem.findFirst({
			where: { id, deletedAt: null },
			select: { id: true, active: true }
		});

		if (!item) {
			return fail(404, { error: 'Item not found' });
		}

		await prisma.priceListItem.update({
			where: { id },
			data: { active }
		});

		await logUpdate(
			locals.user!.id,
			'pricelists',
			String(id),
			'PriceListItem',
			{ active: item.active },
			{ active }
		);

		return { success: true };
	}
};
