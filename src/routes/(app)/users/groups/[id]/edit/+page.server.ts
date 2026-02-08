import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail, redirect, error } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'settings', 'users');

	// Parse group ID
	const groupId = parseInt(params.id);
	if (isNaN(groupId)) {
		error(400, 'Invalid group ID');
	}

	// Check if current user is admin (can edit deleted groups)
	const isAdmin = checkPermission(locals, '*', '*');

	// Find the group
	const group = await prisma.userGroup.findUnique({
		where: { id: groupId },
		select: {
			id: true,
			name: true,
			description: true,
			deletedAt: true,
			permissions: {
				select: {
					permissionId: true
				}
			}
		}
	});

	if (!group) {
		error(404, 'Group not found');
	}

	// If group is deleted and current user is not admin, deny access
	if (group.deletedAt && !isAdmin) {
		error(403, 'Only administrators can edit deleted groups');
	}

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

	return {
		group: {
			...group,
			permissionIds: group.permissions.map(p => p.permissionId),
			isDeleted: group.deletedAt !== null
		},
		permissions,
		groupedPermissions,
		isAdmin
	};
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		await requirePermission(locals, 'settings', 'users');

		// Parse group ID
		const groupId = parseInt(params.id);
		if (isNaN(groupId)) {
			return fail(400, { error: 'Invalid group ID' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const permissionIdsStr = formData.getAll('permissions') as string[];
		const permissionIds = permissionIdsStr.map(id => parseInt(id)).filter(id => !isNaN(id));

		// Validation
		const errors: Record<string, string> = {};

		if (!name?.trim()) {
			errors.name = 'Name is required';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { name, description, permissionIds: permissionIdsStr } });
		}

		// Check if name already exists for another group
		const existingGroup = await prisma.userGroup.findFirst({
			where: {
				name,
				id: { not: groupId }
			}
		});

		if (existingGroup) {
			return fail(400, {
				errors: { name: 'A group with this name already exists' },
				values: { name, description, permissionIds: permissionIdsStr }
			});
		}

		// Get old values for audit
		const oldGroup = await prisma.userGroup.findUnique({
			where: { id: groupId },
			include: {
				permissions: {
					select: { permissionId: true }
				}
			}
		});

		// Update group and permissions in a transaction
		await prisma.$transaction(async (tx) => {
			// Update group
			await tx.userGroup.update({
				where: { id: groupId },
				data: {
					name,
					description: description || null
				}
			});

			// Remove old permissions
			await tx.groupPermission.deleteMany({
				where: { userGroupId: groupId }
			});

			// Add new permissions
			if (permissionIds.length > 0) {
				await tx.groupPermission.createMany({
					data: permissionIds.map(permissionId => ({
						userGroupId: groupId,
						permissionId
					}))
				});
			}
		});

		await logUpdate(
			locals.user!.id,
			'user-groups',
			String(groupId),
			'UserGroup',
			{
				name: oldGroup?.name,
				description: oldGroup?.description,
				permissions: oldGroup?.permissions.map(p => p.permissionId)
			},
			{
				name,
				description,
				permissions: permissionIds
			}
		);

		redirect(303, '/users/groups');
	}
};
