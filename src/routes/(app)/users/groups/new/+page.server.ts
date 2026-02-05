import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail, redirect } from '@sveltejs/kit';
import { logCreate } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'settings', 'users');

	// Get all permissions for selection
	const permissions = await prisma.permission.findMany({
		where: { deletedAt: null },
		orderBy: [{ module: 'asc' }, { action: 'asc' }],
		select: {
			id: true,
			module: true,
			action: true,
			description: true
		}
	});

	// Group permissions by module for better UI
	const groupedPermissions = permissions.reduce((acc, perm) => {
		if (!acc[perm.module]) {
			acc[perm.module] = [];
		}
		acc[perm.module].push(perm);
		return acc;
	}, {} as Record<string, typeof permissions>);

	return { permissions, groupedPermissions };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		await requirePermission(locals, 'settings', 'users');

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const permissionIds = formData.getAll('permissions') as string[];

		// Validation
		const errors: Record<string, string> = {};

		if (!name?.trim()) {
			errors.name = 'Name is required';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { name, description, permissionIds } });
		}

		// Check if name already exists
		const existingGroup = await prisma.userGroup.findUnique({
			where: { name }
		});

		if (existingGroup) {
			return fail(400, {
				errors: { name: 'A group with this name already exists' },
				values: { name, description, permissionIds }
			});
		}

		// Create group with permissions
		const group = await prisma.userGroup.create({
			data: {
				name,
				description: description || null,
				permissions: {
					create: permissionIds.map(permissionId => ({
						permissionId: parseInt(permissionId)
					}))
				}
			}
		});

		await logCreate(locals.user!.id, 'user-groups', String(group.id), 'UserGroup', {
			name,
			description,
			permissions: permissionIds
		});

		redirect(303, '/users/groups');
	}
};
