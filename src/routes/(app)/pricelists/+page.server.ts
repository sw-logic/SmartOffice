import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';
import { parseListParams, buildPagination, serializeDecimals, createDeleteAction, parseFormId } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'pricelists', 'read');

	const isAdmin = checkPermission(locals, '*', '*');

	const { search, sortBy, sortOrder, page, limit } = parseListParams(url, { limit: 50 });
	const category = url.searchParams.get('category') || '';
	const active = url.searchParams.get('active') || 'true';

	// Build where clause
	const where: any = {};

	// Handle active filter
	if (active === 'false') {
		where.active = false;
	} else if (active === 'true') {
		where.active = true;
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
			_count: {
				select: {
					offerItems: true
				}
			}
		},
		orderBy,
		skip: (page - 1) * limit,
		take: limit
	});

	// Convert Decimal fields to numbers for serialization
	const items = itemsRaw.map((item) => serializeDecimals(item, ['unitPrice', 'taxRate']));

	// Get distinct categories for filter
	const categoriesRaw = await prisma.priceListItem.findMany({
		where: {
			category: { not: null }
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
		pageSize: limit,
		totalPages: Math.ceil(totalCount / limit),
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
	delete: createDeleteAction({
		permission: ['pricelists', 'delete'],
		module: 'pricelists',
		entityType: 'PriceListItem',
		model: 'priceListItem',
		findSelect: { id: true, name: true, sku: true, unitPrice: true },
		auditValues: (record) => ({
			name: record.name,
			sku: record.sku,
			unitPrice: Number(record.unitPrice)
		})
	}),

	toggleActive: async ({ locals, request }) => {
		await requirePermission(locals, 'pricelists', 'update');

		const formData = await request.formData();
		const result = parseFormId(formData, 'id', 'Item');
		if ('error' in result) return result.error;
		const { id } = result;

		const active = formData.get('active') === 'true';

		const item = await prisma.priceListItem.findUnique({
			where: { id },
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
