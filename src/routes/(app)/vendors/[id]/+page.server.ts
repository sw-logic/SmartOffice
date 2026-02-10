import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { error, fail } from '@sveltejs/kit';
import { logCreate, logUpdate, logDelete } from '$lib/server/audit';
import { parseId } from '$lib/server/crud-helpers';
import { saveAvatar, deleteFile } from '$lib/server/file-upload';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'vendors', 'read');

	// Parse vendor ID
	const vendorId = parseId(params.id, 'vendor');

	const vendor = await prisma.vendor.findUnique({
		where: { id: vendorId },
		include: {
			contacts: {
				orderBy: [{ lastName: 'asc' }],
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					phone: true,
					mobile: true,
					position: true,
					avatarPath: true
				}
			},
			expenses: {
				orderBy: { date: 'desc' },
				take: 5,
				select: {
					id: true,
					amount: true,
					currency: true,
					date: true,
					description: true,
					category: true
				}
			},
			_count: {
				select: {
					expenses: true,
					contacts: true
				}
			}
		}
	});

	if (!vendor) {
		error(404, 'Vendor not found');
	}

	// Calculate total expenses
	const totalExpenses = await prisma.expense.aggregate({
		where: {
			vendorId: vendorId
		},
		_sum: {
			amount: true
		}
	});

	return {
		vendor: {
			...vendor,
			contacts: vendor.contacts,
			expenses: vendor.expenses.map(exp => ({
				...exp,
				amount: Number(exp.amount)
			})),
			_count: vendor._count,
			totalExpenses: Number(totalExpenses._sum.amount || 0)
		}
	};
};

export const actions: Actions = {
	createContact: async ({ locals, request, params }) => {
		await requirePermission(locals, 'vendors', 'contacts');

		// Parse vendor ID
		const vendorId = parseId(params.id, 'vendor');

		const formData = await request.formData();
		const firstName = formData.get('firstName') as string;
		const lastName = formData.get('lastName') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;
		const mobile = formData.get('mobile') as string;
		const position = formData.get('position') as string;
		const avatarFile = formData.get('avatar') as File | null;

		// Validation
		if (!firstName?.trim()) {
			return fail(400, { error: 'First name is required' });
		}
		if (!lastName?.trim()) {
			return fail(400, { error: 'Last name is required' });
		}

		// Verify vendor exists
		const vendor = await prisma.vendor.findUnique({
			where: { id: vendorId },
			select: { id: true, name: true }
		});

		if (!vendor) {
			return fail(404, { error: 'Vendor not found' });
		}

		// Handle avatar upload
		let avatarPath: string | null = null;
		if (avatarFile && avatarFile.size > 0) {
			const uploadResult = await saveAvatar(avatarFile);
			if (!uploadResult.success) {
				return fail(400, { error: uploadResult.error });
			}
			avatarPath = uploadResult.path!;
		}

		// Create contact
		const contact = await prisma.contact.create({
			data: {
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				email: email?.trim() || null,
				phone: phone?.trim() || null,
				mobile: mobile?.trim() || null,
				position: position?.trim() || null,
				avatarPath,
				vendorId: vendorId
			}
		});

		await logCreate(locals.user!.id, 'vendors', String(contact.id), 'Contact', {
			firstName: contact.firstName,
			lastName: contact.lastName,
			email: contact.email,
			vendorId: vendorId,
			vendorName: vendor.name
		});

		return { success: true, contact };
	},

	updateContact: async ({ locals, request, params }) => {
		await requirePermission(locals, 'vendors', 'contacts');

		// Parse vendor ID
		const vendorId = parseId(params.id, 'vendor');

		const formData = await request.formData();
		const contactIdStr = formData.get('contactId') as string;
		const firstName = formData.get('firstName') as string;
		const lastName = formData.get('lastName') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;
		const mobile = formData.get('mobile') as string;
		const position = formData.get('position') as string;
		const avatarFile = formData.get('avatar') as File | null;
		const removeAvatarFlag = formData.get('removeAvatar') === 'true';

		if (!contactIdStr) {
			return fail(400, { error: 'Contact ID is required' });
		}
		const contactId = parseInt(contactIdStr);
		if (isNaN(contactId)) {
			return fail(400, { error: 'Invalid contact ID' });
		}
		if (!firstName?.trim()) {
			return fail(400, { error: 'First name is required' });
		}
		if (!lastName?.trim()) {
			return fail(400, { error: 'Last name is required' });
		}

		// Verify contact exists and belongs to this vendor
		const existingContact = await prisma.contact.findFirst({
			where: {
				id: contactId,
				vendorId: vendorId
			}
		});

		if (!existingContact) {
			return fail(404, { error: 'Contact not found' });
		}

		// Handle avatar upload/removal
		let avatarPath: string | null | undefined = undefined;
		if (avatarFile && avatarFile.size > 0) {
			const uploadResult = await saveAvatar(avatarFile);
			if (!uploadResult.success) {
				return fail(400, { error: uploadResult.error });
			}
			if (existingContact.avatarPath) {
				await deleteFile(existingContact.avatarPath);
			}
			avatarPath = uploadResult.path!;
		} else if (removeAvatarFlag) {
			if (existingContact.avatarPath) {
				await deleteFile(existingContact.avatarPath);
			}
			avatarPath = null;
		}

		// Update contact
		const updateData: Record<string, unknown> = {
			firstName: firstName.trim(),
			lastName: lastName.trim(),
			email: email?.trim() || null,
			phone: phone?.trim() || null,
			mobile: mobile?.trim() || null,
			position: position?.trim() || null
		};
		if (avatarPath !== undefined) {
			updateData.avatarPath = avatarPath;
		}

		const updatedContact = await prisma.contact.update({
			where: { id: contactId },
			data: updateData
		});

		await logUpdate(locals.user!.id, 'vendors', String(contactId), 'Contact', existingContact, {
			firstName: updatedContact.firstName,
			lastName: updatedContact.lastName,
			email: updatedContact.email,
			phone: updatedContact.phone,
			mobile: updatedContact.mobile,
			position: updatedContact.position
		});

		return { success: true, contact: updatedContact };
	},

	deleteContact: async ({ locals, request, params }) => {
		await requirePermission(locals, 'vendors', 'contacts');

		// Parse vendor ID
		const vendorId = parseId(params.id, 'vendor');

		const formData = await request.formData();
		const contactIdStr = formData.get('contactId') as string;

		if (!contactIdStr) {
			return fail(400, { error: 'Contact ID is required' });
		}
		const contactId = parseInt(contactIdStr);
		if (isNaN(contactId)) {
			return fail(400, { error: 'Invalid contact ID' });
		}

		// Verify contact exists and belongs to this vendor
		const contact = await prisma.contact.findFirst({
			where: {
				id: contactId,
				vendorId: vendorId
			},
			select: {
				id: true,
				firstName: true,
				lastName: true,
				email: true
			}
		});

		if (!contact) {
			return fail(404, { error: 'Contact not found' });
		}

		// Log before hard delete
		await logDelete(locals.user!.id, 'vendors', String(contactId), 'Contact', {
			firstName: contact.firstName,
			lastName: contact.lastName,
			email: contact.email
		});

		await prisma.contact.delete({
			where: { id: contactId }
		});

		return { success: true };
	}
};
