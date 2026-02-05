import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail, redirect, error } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';
import { getEnumValuesBatch } from '$lib/server/enums';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'pricelists', 'update');

	// Parse item ID
	const itemId = parseInt(params.id);
	if (isNaN(itemId)) {
		error(400, 'Invalid item ID');
	}

	const [itemRaw, existingCategoriesRaw, enums] = await Promise.all([
		prisma.priceListItem.findFirst({
			where: { id: itemId, deletedAt: null }
		}),
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

	if (!itemRaw) {
		error(404, 'Price list item not found');
	}

	// Convert Decimal fields to numbers for serialization
	const item = {
		...itemRaw,
		unitPrice: Number(itemRaw.unitPrice),
		taxRate: itemRaw.taxRate ? Number(itemRaw.taxRate) : null
	};

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
		item,
		categories,
		currencies: enums.currency,
		unitOptions: enums.unit_of_measure
	};
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		await requirePermission(locals, 'pricelists', 'update');

		// Parse item ID
		const itemId = parseInt(params.id);
		if (isNaN(itemId)) {
			return fail(400, { error: 'Invalid item ID' });
		}

		const item = await prisma.priceListItem.findFirst({
			where: { id: itemId, deletedAt: null }
		});

		if (!item) {
			return fail(404, { error: 'Price list item not found' });
		}

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

		// Check for duplicate SKU (excluding current item)
		if (sku && sku.trim() !== item.sku) {
			const existingItem = await prisma.priceListItem.findFirst({
				where: {
					sku: sku.trim(),
					id: { not: itemId }
				}
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

		// Capture old values for audit
		const oldValues = {
			name: item.name,
			description: item.description,
			sku: item.sku,
			category: item.category,
			unitPrice: Number(item.unitPrice),
			currency: item.currency,
			unitOfMeasure: item.unitOfMeasure,
			taxRate: item.taxRate ? Number(item.taxRate) : null,
			active: item.active,
			validFrom: item.validFrom,
			validTo: item.validTo,
			notes: item.notes
		};

		// Update item
		const updatedItem = await prisma.priceListItem.update({
			where: { id: itemId },
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

		const newValues = {
			name: updatedItem.name,
			description: updatedItem.description,
			sku: updatedItem.sku,
			category: updatedItem.category,
			unitPrice: Number(updatedItem.unitPrice),
			currency: updatedItem.currency,
			unitOfMeasure: updatedItem.unitOfMeasure,
			taxRate: updatedItem.taxRate ? Number(updatedItem.taxRate) : null,
			active: updatedItem.active,
			validFrom: updatedItem.validFrom,
			validTo: updatedItem.validTo,
			notes: updatedItem.notes
		};

		await logUpdate(locals.user!.id, 'pricelists', String(item.id), 'PriceListItem', oldValues, newValues);

		redirect(303, '/pricelists');
	}
};
