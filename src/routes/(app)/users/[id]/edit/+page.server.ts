import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail, redirect, error } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';
import { saveAvatar, deleteFile } from '$lib/server/file-upload';
import bcrypt from 'bcryptjs';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'settings', 'users');

	const userId = parseInt(params.id);
	if (isNaN(userId)) {
		error(400, 'Invalid user ID');
	}

	const isAdmin = checkPermission(locals, '*', '*');
	const canManageSalary = checkPermission(locals, 'employees', 'salary');

	const [user, userGroups, company] = await Promise.all([
		prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				name: true,
				email: true,
				image: true,
				firstName: true,
				lastName: true,
				phone: true,
				mobile: true,
				dateOfBirth: true,
				street: true,
				city: true,
				postalCode: true,
				country: true,
				companyId: true,
				hireDate: true,
				employmentType: true,
				department: true,
				jobTitle: true,
				employeeStatus: true,
				salary: true,
				salary_tax: true,
				salary_bonus: true,
				emergencyContact: true,
				notes: true,
				userGroups: {
					select: {
						userGroupId: true
					}
				}
			}
		}),
		prisma.userGroup.findMany({
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				description: true
			}
		}),
		prisma.company.findFirst({
			select: { id: true, name: true }
		})
	]);

	if (!user) {
		error(404, 'User not found');
	}

	return {
		user: {
			...user,
			groupIds: user.userGroups.map((ug) => ug.userGroupId),
			salary: Number(user.salary) || null,
			salary_tax: Number(user.salary_tax) || null,
			salary_bonus: Number(user.salary_bonus) || null,
			dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : '',
			hireDate: user.hireDate ? user.hireDate.toISOString().split('T')[0] : ''
		},
		userGroups,
		isAdmin,
		canManageSalary,
		companyId: company?.id || null
	};
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		await requirePermission(locals, 'settings', 'users');

		const userId = parseInt(params.id);
		if (isNaN(userId)) {
			return fail(400, { errors: { name: 'Invalid user ID' } });
		}

		const canManageSalary = checkPermission(locals, 'employees', 'salary');

		const formData = await request.formData();

		// Account fields
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const groupIds = formData.getAll('groups') as string[];

		// Personal info
		const firstName = formData.get('firstName') as string;
		const lastName = formData.get('lastName') as string;
		const phone = formData.get('phone') as string;
		const mobile = formData.get('mobile') as string;
		const dateOfBirth = formData.get('dateOfBirth') as string;

		// Address
		const street = formData.get('street') as string;
		const city = formData.get('city') as string;
		const postalCode = formData.get('postalCode') as string;
		const country = formData.get('country') as string;

		// Employment
		const companyId = formData.get('companyId') as string;
		const hireDate = formData.get('hireDate') as string;
		const employmentType = formData.get('employmentType') as string;
		const department = formData.get('department') as string;
		const jobTitle = formData.get('jobTitle') as string;
		const employeeStatus = formData.get('employeeStatus') as string;

		// Additional
		const emergencyContact = formData.get('emergencyContact') as string;
		const notes = formData.get('notes') as string;

		// Avatar
		const avatarFile = formData.get('avatar') as File | null;
		const removeAvatarFlag = formData.get('removeAvatar') === 'true';

		// Salary (only if permitted)
		const salaryStr = formData.get('salary') as string;
		const salaryTaxStr = formData.get('salary_tax') as string;
		const salaryBonusStr = formData.get('salary_bonus') as string;

		const allValues = {
			name,
			email,
			groupIds,
			firstName,
			lastName,
			phone,
			mobile,
			dateOfBirth,
			street,
			city,
			postalCode,
			country,
			companyId,
			hireDate,
			employmentType,
			department,
			jobTitle,
			employeeStatus,
			emergencyContact,
			notes,
			salary: salaryStr,
			salary_tax: salaryTaxStr,
			salary_bonus: salaryBonusStr
		};

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
			return fail(400, { errors, values: allValues });
		}

		// Check if email already exists for another user
		const existingUser = await prisma.user.findFirst({
			where: {
				email,
				id: { not: userId }
			}
		});

		if (existingUser) {
			return fail(400, {
				errors: { email: 'A user with this email already exists' },
				values: allValues
			});
		}

		// Get old values for audit
		const oldUser = await prisma.user.findUnique({
			where: { id: userId },
			include: {
				userGroups: {
					select: { userGroupId: true }
				}
			}
		});

		// Build update data
		const updateData: Record<string, unknown> = {
			name,
			email,
			firstName: firstName?.trim() || null,
			lastName: lastName?.trim() || null,
			phone: phone?.trim() || null,
			mobile: mobile?.trim() || null,
			dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
			street: street?.trim() || null,
			city: city?.trim() || null,
			postalCode: postalCode?.trim() || null,
			country: country?.trim() || null,
			companyId: companyId ? parseInt(companyId) : null,
			hireDate: hireDate ? new Date(hireDate) : null,
			employmentType: employmentType || null,
			department: department || null,
			jobTitle: jobTitle?.trim() || null,
			employeeStatus: employeeStatus || null,
			emergencyContact: emergencyContact?.trim() || null,
			notes: notes?.trim() || null
		};

		if (password) {
			updateData.password = await bcrypt.hash(password, 10);
		}

		// Handle avatar upload/removal
		if (avatarFile && avatarFile.size > 0) {
			const uploadResult = await saveAvatar(avatarFile);
			if (!uploadResult.success) {
				return fail(400, { errors: { avatar: uploadResult.error || 'Avatar upload failed' }, values: allValues });
			}
			if (oldUser?.image) {
				await deleteFile(oldUser.image);
			}
			updateData.image = uploadResult.path!;
		} else if (removeAvatarFlag) {
			if (oldUser?.image) {
				await deleteFile(oldUser.image);
			}
			updateData.image = null;
		}

		// Only set salary fields if user has permission
		if (canManageSalary) {
			updateData.salary = salaryStr ? parseFloat(salaryStr) : null;
			updateData.salary_tax = salaryTaxStr ? parseFloat(salaryTaxStr) : null;
			updateData.salary_bonus = salaryBonusStr ? parseFloat(salaryBonusStr) : null;
		}

		// Update user and groups in a transaction
		await prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: userId },
				data: updateData
			});

			// Remove old groups
			await tx.userGroupUser.deleteMany({
				where: { userId }
			});

			// Add new groups
			if (groupIds.length > 0) {
				await tx.userGroupUser.createMany({
					data: groupIds.map((groupId) => ({
						userId,
						userGroupId: parseInt(groupId)
					}))
				});
			}
		});

		await logUpdate(
			locals.user!.id,
			'users',
			String(userId),
			'User',
			{
				name: oldUser?.name,
				email: oldUser?.email,
				firstName: oldUser?.firstName,
				lastName: oldUser?.lastName,
				department: oldUser?.department,
				jobTitle: oldUser?.jobTitle,
				employeeStatus: oldUser?.employeeStatus,
				groups: oldUser?.userGroups.map((ug) => ug.userGroupId)
			},
			{
				name,
				email,
				firstName: firstName || null,
				lastName: lastName || null,
				department: department || null,
				jobTitle: jobTitle || null,
				employeeStatus: employeeStatus || null,
				groups: groupIds
			}
		);

		redirect(303, `/users/${userId}`);
	}
};
