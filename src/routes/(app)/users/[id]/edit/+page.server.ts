import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail, redirect, error } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';
import bcrypt from 'bcryptjs';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'settings', 'users');

	// Check if current user is admin (can edit deleted users)
	const isAdmin = locals.user ? await checkPermission(locals.user.id, '*', '*') : false;

	// First find the user without deletedAt filter
	const user = await prisma.user.findUnique({
		where: { id: params.id },
		select: {
			id: true,
			name: true,
			email: true,
			deletedAt: true,
			userGroups: {
				select: {
					userGroupId: true
				}
			}
		}
	});

	if (!user) {
		error(404, 'User not found');
	}

	// If user is deleted and current user is not admin, deny access
	if (user.deletedAt && !isAdmin) {
		error(403, 'Only administrators can edit deleted users');
	}

	const userGroups = await prisma.userGroup.findMany({
		where: { deletedAt: null },
		orderBy: { name: 'asc' },
		select: {
			id: true,
			name: true,
			description: true
		}
	});

	return {
		user: {
			...user,
			groupIds: user.userGroups.map(ug => ug.userGroupId),
			isDeleted: user.deletedAt !== null
		},
		userGroups,
		isAdmin
	};
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		await requirePermission(locals, 'settings', 'users');

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const groupIds = formData.getAll('groups') as string[];

		// Validation
		const errors: Record<string, string> = {};

		if (!name?.trim()) {
			errors.name = 'Name is required';
		}

		if (!email?.trim()) {
			errors.email = 'Email is required';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			errors.email = 'Invalid email format';
		}

		if (password && password.length < 6) {
			errors.password = 'Password must be at least 6 characters';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { name, email, groupIds } });
		}

		// Check if email already exists for another user
		const existingUser = await prisma.user.findFirst({
			where: {
				email,
				id: { not: params.id }
			}
		});

		if (existingUser) {
			return fail(400, {
				errors: { email: 'A user with this email already exists' },
				values: { name, email, groupIds }
			});
		}

		// Get old values for audit
		const oldUser = await prisma.user.findUnique({
			where: { id: params.id },
			include: {
				userGroups: {
					select: { userGroupId: true }
				}
			}
		});

		// Prepare update data
		const updateData: {
			name: string;
			email: string;
			password?: string;
		} = { name, email };

		if (password) {
			updateData.password = await bcrypt.hash(password, 10);
		}

		// Update user and groups in a transaction
		await prisma.$transaction(async (tx) => {
			// Update user
			await tx.user.update({
				where: { id: params.id },
				data: updateData
			});

			// Remove old groups
			await tx.userGroupUser.deleteMany({
				where: { userId: params.id }
			});

			// Add new groups
			if (groupIds.length > 0) {
				await tx.userGroupUser.createMany({
					data: groupIds.map(groupId => ({
						userId: params.id,
						userGroupId: parseInt(groupId)
					}))
				});
			}
		});

		await logUpdate(
			locals.user!.id,
			'users',
			params.id,
			'User',
			{
				name: oldUser?.name,
				email: oldUser?.email,
				groups: oldUser?.userGroups.map(ug => ug.userGroupId)
			},
			{
				name,
				email,
				groups: groupIds
			}
		);

		redirect(303, '/users');
	}
};
