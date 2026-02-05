import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail, redirect } from '@sveltejs/kit';
import { logCreate } from '$lib/server/audit';
import { getEnumValuesBatch } from '$lib/server/enums';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'pricelists', 'create');

	const [existingCategoriesRaw, enums] = await Promise.all([
		// Get distinct categories from existing items (for backward compatibility)
		prisma.priceListItem.findMany({
			where: {
				category: { not: null },
				deletedAt: null
			},
			select: { category: true },
			distinct: ['category']
		}),
		// Get enum values
		getEnumValuesBatch(['pricelist_category', 'currency', 'unit_of_measure'])
	]);

	// Merge existing categories with enum categories
	const existingCategories = existingCategoriesRaw
		.map((c) => c.category)
		.filter((c): c is string => c !== null);
	const enumCategoryValues = enums.pricelist_category.map((c) => c.value);
	const allCategoryValues = [...new Set([...enumCategoryValues, ...existingCategories])].sort();

	// Convert to value/label format (existing items might not have labels)
	const categories = allCategoryValues.map((value) => {
		const enumItem = enums.pricelist_category.find((c) => c.value === value);
		return enumItem || { value, label: value, isDefault: false };
	});

	return {
		categories,
		currencies: enums.currency,
		unitOptions: enums.unit_of_measure
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		await requirePermission(locals, 'pricelists', 'create');

		const formData = await request.formData();

		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const sku = formData.get('sku') as string;
		const category = formData.get('category') as string;
		const unitPrice = formData.get('unitPrice') as string;
		const currency = (formData.get('currency') as string) || 'USD';
		const unitOfMeasure = (formData.get('unitOfMeasure') as string) || 'piece';
		const taxRate = formData.get('taxRate') as string;
		const active = formData.get('active') !== 'false';
		const validFrom = formData.get('validFrom') as string;
		const validTo = formData.get('validTo') as string;
		const notes = formData.get('notes') as string;

		// Validation
		const errors: Record<string, string> = {};

		if (!name?.trim()) {
			errors.name = 'Name is required';
		}

		if (!unitPrice || isNaN(parseFloat(unitPrice)) || parseFloat(unitPrice) < 0) {
			errors.unitPrice = 'Please enter a valid price';
		}

		if (taxRate && (isNaN(parseFloat(taxRate)) || parseFloat(taxRate) < 0 || parseFloat(taxRate) > 100)) {
			errors.taxRate = 'Tax rate must be between 0 and 100';
		}

		// Check for duplicate SKU
		if (sku) {
			const existingItem = await prisma.priceListItem.findFirst({
				where: { sku: sku.trim() }
			});
			if (existingItem) {
				errors.sku = 'An item with this SKU already exists';
			}
		}

		// Validate date range
		if (validFrom && validTo && new Date(validFrom) > new Date(validTo)) {
			errors.validTo = 'End date must be after start date';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, {
				errors,
				values: {
					name,
					description,
					sku,
					category,
					unitPrice,
					currency,
					unitOfMeasure,
					taxRate,
					active,
					validFrom,
					validTo,
					notes
				}
			});
		}

		// Create item
		const item = await prisma.priceListItem.create({
			data: {
				name: name.trim(),
				description: description?.trim() || null,
				sku: sku?.trim() || null,
				category: category || null,
				unitPrice: parseFloat(unitPrice),
				currency,
				unitOfMeasure,
				taxRate: taxRate ? parseFloat(taxRate) : null,
				active,
				validFrom: validFrom ? new Date(validFrom) : null,
				validTo: validTo ? new Date(validTo) : null,
				notes: notes?.trim() || null
			}
		});

		await logCreate(locals.user!.id, 'pricelists', String(item.id), 'PriceListItem', {
			name: item.name,
			sku: item.sku,
			unitPrice: item.unitPrice,
			category: item.category
		});

		redirect(303, '/pricelists');
	}
};
