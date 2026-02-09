import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail, error } from '@sveltejs/kit';
import { logCreate, logUpdate, logDelete } from '$lib/server/audit';
import { clearEnumCache } from '$lib/server/enums';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'settings', 'enums');

	const isAdmin = checkPermission(locals, '*', '*');

	const enumType = await prisma.enumType.findUnique({
		where: { code: params.code },
		include: {
			values: {
				orderBy: { sortOrder: 'asc' }
			}
		}
	});

	if (!enumType) {
		throw error(404, 'Enum type not found');
	}

	return {
		enumType: {
			id: enumType.id,
			code: enumType.code,
			name: enumType.name,
			description: enumType.description,
			isSystem: enumType.isSystem
		},
		values: enumType.values.map((v) => ({
			id: v.id,
			value: v.value,
			label: v.label,
			description: v.description,
			sortOrder: v.sortOrder,
			isDefault: v.isDefault,
			isActive: v.isActive,
			color: v.color,
			metadata: v.metadata as Record<string, unknown> | null,
			createdAt: v.createdAt
		})),
		isAdmin
	};
};

export const actions: Actions = {
	create: async ({ locals, request, params }) => {
		await requirePermission(locals, 'settings', 'enums');

		const formData = await request.formData();
		const value = (formData.get('value') as string)?.trim();
		const label = (formData.get('label') as string)?.trim();
		const description = (formData.get('description') as string)?.trim() || null;
		const color = (formData.get('color') as string)?.trim() || null;

		if (!value || !label) {
			return fail(400, { error: 'Value and label are required' });
		}

		const enumType = await prisma.enumType.findUnique({
			where: { code: params.code }
		});

		if (!enumType) {
			return fail(404, { error: 'Enum type not found' });
		}

		// Check for duplicate value
		const existing = await prisma.enumValue.findUnique({
			where: {
				enumTypeId_value: {
					enumTypeId: enumType.id,
					value
				}
			}
		});

		if (existing) {
			return fail(400, { error: 'A value with this code already exists' });
		}

		// Get max sortOrder
		const maxOrder = await prisma.enumValue.aggregate({
			where: { enumTypeId: enumType.id },
			_max: { sortOrder: true }
		});

		const newValue = await prisma.enumValue.create({
			data: {
				enumTypeId: enumType.id,
				value,
				label,
				description,
				color,
				sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
				isDefault: false,
				isActive: true
			}
		});

		clearEnumCache(params.code);

		await logCreate(locals.user!.id, 'settings.enums', String(newValue.id), 'EnumValue', {
			enumType: enumType.code,
			value,
			label
		});

		return { success: true };
	},

	update: async ({ locals, request, params }) => {
		await requirePermission(locals, 'settings', 'enums');

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const value = (formData.get('value') as string)?.trim();
		const label = (formData.get('label') as string)?.trim();
		const description = (formData.get('description') as string)?.trim() || null;
		const color = (formData.get('color') as string)?.trim() || null;
		const isActive = formData.get('isActive') === 'true';

		if (!id || !value || !label) {
			return fail(400, { error: 'ID, value, and label are required' });
		}

		const enumType = await prisma.enumType.findUnique({
			where: { code: params.code }
		});

		if (!enumType) {
			return fail(404, { error: 'Enum type not found' });
		}

		const existing = await prisma.enumValue.findUnique({
			where: { id }
		});

		if (!existing || existing.enumTypeId !== enumType.id) {
			return fail(404, { error: 'Value not found' });
		}

		// Check for duplicate value (excluding current)
		const duplicate = await prisma.enumValue.findFirst({
			where: {
				enumTypeId: enumType.id,
				value,
				id: { not: id }
			}
		});

		if (duplicate) {
			return fail(400, { error: 'A value with this code already exists' });
		}

		await prisma.enumValue.update({
			where: { id },
			data: {
				value,
				label,
				description,
				color,
				isActive
			}
		});

		clearEnumCache(params.code);

		await logUpdate(
			locals.user!.id,
			'settings.enums',
			String(id),
			'EnumValue',
			{ value: existing.value, label: existing.label, isActive: existing.isActive },
			{ value, label, isActive }
		);

		return { success: true };
	},

	setDefault: async ({ locals, request, params }) => {
		await requirePermission(locals, 'settings', 'enums');

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);

		if (!id) {
			return fail(400, { error: 'ID is required' });
		}

		const enumType = await prisma.enumType.findUnique({
			where: { code: params.code }
		});

		if (!enumType) {
			return fail(404, { error: 'Enum type not found' });
		}

		const value = await prisma.enumValue.findUnique({
			where: { id }
		});

		if (!value || value.enumTypeId !== enumType.id) {
			return fail(404, { error: 'Value not found' });
		}

		// Remove default from all other values
		await prisma.enumValue.updateMany({
			where: { enumTypeId: enumType.id },
			data: { isDefault: false }
		});

		// Set this value as default
		await prisma.enumValue.update({
			where: { id },
			data: { isDefault: true }
		});

		clearEnumCache(params.code);

		await logUpdate(locals.user!.id, 'settings.enums', String(id), 'EnumValue', {}, { isDefault: true });

		return { success: true };
	},

	reorder: async ({ locals, request, params }) => {
		await requirePermission(locals, 'settings', 'enums');

		const formData = await request.formData();
		const ordersJson = formData.get('orders') as string;

		if (!ordersJson) {
			return fail(400, { error: 'Orders are required' });
		}

		const orders: Array<{ id: number; sortOrder: number }> = JSON.parse(ordersJson);

		const enumType = await prisma.enumType.findUnique({
			where: { code: params.code }
		});

		if (!enumType) {
			return fail(404, { error: 'Enum type not found' });
		}

		// Update all orders in a transaction
		await prisma.$transaction(
			orders.map((order) =>
				prisma.enumValue.update({
					where: { id: order.id },
					data: { sortOrder: order.sortOrder }
				})
			)
		);

		clearEnumCache(params.code);

		return { success: true };
	},

	delete: async ({ locals, request, params }) => {
		await requirePermission(locals, 'settings', 'enums');

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);

		if (!id) {
			return fail(400, { error: 'ID is required' });
		}

		const enumType = await prisma.enumType.findUnique({
			where: { code: params.code }
		});

		if (!enumType) {
			return fail(404, { error: 'Enum type not found' });
		}

		const value = await prisma.enumValue.findUnique({
			where: { id }
		});

		if (!value || value.enumTypeId !== enumType.id) {
			return fail(404, { error: 'Value not found' });
		}

		// Audit log before hard delete
		await logDelete(locals.user!.id, 'settings.enums', String(id), 'EnumValue', {
			value: value.value,
			label: value.label
		});

		await prisma.enumValue.delete({
			where: { id }
		});

		clearEnumCache(params.code);

		return { success: true };
	}
};
