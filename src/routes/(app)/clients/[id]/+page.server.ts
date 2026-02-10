import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { parseId } from '$lib/server/crud-helpers';
import { error, fail } from '@sveltejs/kit';
import { logCreate, logUpdate, logDelete } from '$lib/server/audit';
import { saveAvatar, deleteFile } from '$lib/server/file-upload';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'clients', 'read');

	const clientId = parseId(params.id, 'client');

	const client = await prisma.client.findUnique({
		where: { id: clientId },
		include: {
			contacts: {
				orderBy: [{ isPrimaryContact: 'desc' }, { lastName: 'asc' }],
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					phone: true,
					mobile: true,
					position: true,
					avatarPath: true,
					isPrimaryContact: true
				}
			},
			projects: {
				orderBy: { createdAt: 'desc' },
				take: 5,
				select: {
					id: true,
					name: true,
					status: true,
					startDate: true,
					endDate: true
				}
			},
			offers: {
				orderBy: { createdAt: 'desc' },
				take: 5,
				select: {
					id: true,
					offerNumber: true,
					status: true,
					grandTotal: true,
					currency: true,
					date: true
				}
			},
			income: {
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
			createdBy: {
				select: {
					id: true,
					name: true
				}
			},
			_count: {
				select: {
					projects: true,
					contacts: true,
					offers: true,
					income: true,
					payments: true
				}
			}
		}
	});

	if (!client) {
		error(404, 'Client not found');
	}

	// Calculate total income
	const totalIncome = await prisma.income.aggregate({
		where: {
			clientId: clientId
		},
		_sum: {
			amount: true
		}
	});

	return {
		client: {
			...client,
			contacts: client.contacts,
			projects: client.projects,
			offers: client.offers.map(offer => ({
				...offer,
				grandTotal: Number(offer.grandTotal)
			})),
			income: client.income.map(inc => ({
				...inc,
				amount: Number(inc.amount)
			})),
			_count: client._count,
			createdBy: client.createdBy,
			totalIncome: Number(totalIncome._sum.amount || 0)
		}
	};
};

export const actions: Actions = {
	createContact: async ({ locals, request, params }) => {
		await requirePermission(locals, 'clients', 'contacts');

		const formData = await request.formData();
		const firstName = formData.get('firstName') as string;
		const lastName = formData.get('lastName') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;
		const mobile = formData.get('mobile') as string;
		const position = formData.get('position') as string;
		const isPrimaryContact = formData.get('isPrimaryContact') === 'true';
		const avatarFile = formData.get('avatar') as File | null;

		// Validation
		if (!firstName?.trim()) {
			return fail(400, { error: 'First name is required' });
		}
		if (!lastName?.trim()) {
			return fail(400, { error: 'Last name is required' });
		}

		const clientId = parseId(params.id, 'client');

		// Verify client exists
		const client = await prisma.client.findUnique({
			where: { id: clientId },
			select: { id: true, name: true }
		});

		if (!client) {
			return fail(404, { error: 'Client not found' });
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

		// If setting as primary, unset any existing primary contact
		if (isPrimaryContact) {
			await prisma.contact.updateMany({
				where: {
					clientId: clientId,
					isPrimaryContact: true
				},
				data: { isPrimaryContact: false }
			});
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
				isPrimaryContact,
				clientId: clientId
			}
		});

		await logCreate(locals.user!.id, 'clients', String(contact.id), 'Contact', {
			firstName: contact.firstName,
			lastName: contact.lastName,
			email: contact.email,
			clientId: clientId,
			clientName: client.name
		});

		return { success: true, contact };
	},

	updateContact: async ({ locals, request, params }) => {
		await requirePermission(locals, 'clients', 'contacts');

		const formData = await request.formData();
		const contactIdStr = formData.get('contactId') as string;
		const firstName = formData.get('firstName') as string;
		const lastName = formData.get('lastName') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;
		const mobile = formData.get('mobile') as string;
		const position = formData.get('position') as string;
		const isPrimaryContact = formData.get('isPrimaryContact') === 'true';
		const avatarFile = formData.get('avatar') as File | null;
		const removeAvatarFlag = formData.get('removeAvatar') === 'true';

		if (!contactIdStr) {
			return fail(400, { error: 'Contact ID is required' });
		}
		const contactId = parseInt(contactIdStr);
		if (isNaN(contactId)) {
			return fail(400, { error: 'Invalid contact ID' });
		}

		const clientId = parseId(params.id, 'client');

		if (!firstName?.trim()) {
			return fail(400, { error: 'First name is required' });
		}
		if (!lastName?.trim()) {
			return fail(400, { error: 'Last name is required' });
		}

		// Verify contact exists and belongs to this client
		const existingContact = await prisma.contact.findFirst({
			where: {
				id: contactId,
				clientId: clientId
			}
		});

		if (!existingContact) {
			return fail(404, { error: 'Contact not found' });
		}

		// If setting as primary, unset any existing primary contact
		if (isPrimaryContact && !existingContact.isPrimaryContact) {
			await prisma.contact.updateMany({
				where: {
					clientId: clientId,
					isPrimaryContact: true,
					id: { not: contactId }
				},
				data: { isPrimaryContact: false }
			});
		}

		// Handle avatar upload/removal
		let avatarPath: string | null | undefined = undefined; // undefined = no change
		if (avatarFile && avatarFile.size > 0) {
			const uploadResult = await saveAvatar(avatarFile);
			if (!uploadResult.success) {
				return fail(400, { error: uploadResult.error });
			}
			// Delete old avatar if exists
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
			position: position?.trim() || null,
			isPrimaryContact
		};
		if (avatarPath !== undefined) {
			updateData.avatarPath = avatarPath;
		}

		const updatedContact = await prisma.contact.update({
			where: { id: contactId },
			data: updateData
		});

		await logUpdate(locals.user!.id, 'clients', String(contactId), 'Contact', existingContact, {
			firstName: updatedContact.firstName,
			lastName: updatedContact.lastName,
			email: updatedContact.email,
			phone: updatedContact.phone,
			mobile: updatedContact.mobile,
			position: updatedContact.position,
			isPrimaryContact: updatedContact.isPrimaryContact
		});

		return { success: true, contact: updatedContact };
	},

	deleteContact: async ({ locals, request, params }) => {
		await requirePermission(locals, 'clients', 'contacts');

		const formData = await request.formData();
		const contactIdStr = formData.get('contactId') as string;

		if (!contactIdStr) {
			return fail(400, { error: 'Contact ID is required' });
		}
		const contactId = parseInt(contactIdStr);
		if (isNaN(contactId)) {
			return fail(400, { error: 'Invalid contact ID' });
		}

		const clientId = parseId(params.id, 'client');

		// Verify contact exists and belongs to this client
		const contact = await prisma.contact.findFirst({
			where: {
				id: contactId,
				clientId: clientId
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
		await logDelete(locals.user!.id, 'clients', String(contactId), 'Contact', {
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
