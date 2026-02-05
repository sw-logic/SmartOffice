import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail, redirect } from '@sveltejs/kit';
import { logCreate } from '$lib/server/audit';
import bcrypt from 'bcryptjs';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'settings', 'users');

	const userGroups = await prisma.userGroup.findMany({
		where: { deletedAt: null },
		orderBy: { name: 'asc' },
		select: {
			id: true,
			name: true,
			description: true
		}
	});

	return { userGroups };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
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

		if (!password?.trim()) {
			errors.password = 'Password is required';
		} else if (password.length < 6) {
			errors.password = 'Password must be at least 6 characters';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: { name, email, groupIds } });
		}

		// Check if email already exists
		const existingUser = await prisma.user.findUnique({
			where: { email }
		});

		if (existingUser) {
			return fail(400, {
				errors: { email: 'A user with this email already exists' },
				values: { name, email, groupIds }
			});
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create user
		const user = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				userGroups: {
					create: groupIds.map(groupId => ({
						userGroupId: parseInt(groupId)
					}))
				}
			}
		});

		await logCreate(locals.user!.id, 'users', user.id, 'User', {
			name,
			email,
			groups: groupIds
		});

		redirect(303, '/users');
	}
};
