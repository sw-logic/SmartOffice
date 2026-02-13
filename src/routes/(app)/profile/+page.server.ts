import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { fail } from '@sveltejs/kit';
import { logUpdate, logAction } from '$lib/server/audit';
import { saveAvatar, deleteFile } from '$lib/server/file-upload';
import bcrypt from 'bcryptjs';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;

	const user = await prisma.user.findUnique({
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
			emergencyContact: true,
			notes: true,
			department: true,
			jobTitle: true
		}
	});

	if (!user) {
		fail(404, { error: 'User not found' });
		return { profile: null as never };
	}

	return {
		profile: {
			...user,
			dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : ''
		}
	};
};

export const actions: Actions = {
	updateProfile: async ({ locals, request }) => {
		const userId = locals.user!.id;
		const formData = await request.formData();

		// Parse fields
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const firstName = formData.get('firstName') as string;
		const lastName = formData.get('lastName') as string;
		const phone = formData.get('phone') as string;
		const mobile = formData.get('mobile') as string;
		const dateOfBirth = formData.get('dateOfBirth') as string;
		const street = formData.get('street') as string;
		const city = formData.get('city') as string;
		const postalCode = formData.get('postalCode') as string;
		const country = formData.get('country') as string;
		const emergencyContact = formData.get('emergencyContact') as string;
		const notes = formData.get('notes') as string;

		// Avatar
		const avatarFile = formData.get('avatar') as File | null;
		const removeAvatarFlag = formData.get('removeAvatar') === 'true';

		const allValues = {
			name, email, firstName, lastName, phone, mobile,
			dateOfBirth, street, city, postalCode, country,
			emergencyContact, notes
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

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: allValues });
		}

		// Check email uniqueness (excluding self)
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
			where: { id: userId }
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
			emergencyContact: emergencyContact?.trim() || null,
			notes: notes?.trim() || null
		};

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

		await prisma.user.update({
			where: { id: userId },
			data: updateData
		});

		await logUpdate(
			userId,
			'users',
			String(userId),
			'User',
			{
				name: oldUser?.name,
				email: oldUser?.email,
				firstName: oldUser?.firstName,
				lastName: oldUser?.lastName,
				phone: oldUser?.phone,
				mobile: oldUser?.mobile
			},
			{
				name,
				email,
				firstName: firstName || null,
				lastName: lastName || null,
				phone: phone || null,
				mobile: mobile || null
			}
		);

		return { success: true, message: 'Profile updated successfully' };
	},

	changePassword: async ({ locals, request }) => {
		const userId = locals.user!.id;
		const formData = await request.formData();

		const currentPassword = formData.get('currentPassword') as string;
		const newPassword = formData.get('newPassword') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		// Validation
		const errors: Record<string, string> = {};

		if (!currentPassword) {
			errors.currentPassword = 'Current password is required';
		}
		if (!newPassword) {
			errors.newPassword = 'New password is required';
		} else if (newPassword.length < 6) {
			errors.newPassword = 'Password must be at least 6 characters';
		}
		if (!confirmPassword) {
			errors.confirmPassword = 'Please confirm your new password';
		} else if (newPassword !== confirmPassword) {
			errors.confirmPassword = 'Passwords do not match';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, { passwordErrors: errors });
		}

		// Verify current password
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { password: true }
		});

		if (!user) {
			return fail(400, { passwordErrors: { currentPassword: 'User not found' } });
		}

		const isValid = await bcrypt.compare(currentPassword, user.password);
		if (!isValid) {
			return fail(400, { passwordErrors: { currentPassword: 'Current password is incorrect' } });
		}

		// Update password
		const hashedPassword = await bcrypt.hash(newPassword, 10);
		await prisma.user.update({
			where: { id: userId },
			data: { password: hashedPassword }
		});

		await logAction({
			userId,
			action: 'password_changed',
			module: 'users',
			entityId: String(userId),
			entityType: 'User'
		});

		return { passwordSuccess: true, message: 'Password changed successfully' };
	}
};
