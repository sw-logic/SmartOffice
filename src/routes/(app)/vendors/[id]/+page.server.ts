import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { error, fail } from '@sveltejs/kit';
import { logCreate, logUpdate, logDelete } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'vendors', 'read');

	// Parse vendor ID
	const vendorId = parseInt(params.id);
	if (isNaN(vendorId)) {
		error(400, 'Invalid vendor ID');
	}

	// Check if user is admin (can view deleted vendors)
	const isAdmin = checkPermission(locals, '*', '*');

	const vendor = await prisma.vendor.findUnique({
		where: { id: vendorId },
		include: {
			contacts: {
				where: { deletedAt: null },
				orderBy: [{ lastName: 'asc' }],
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					phone: true,
					mobile: true,
					position: true
				}
			},
			expenses: {
				where: { deletedAt: null },
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
					expenses: { where: { deletedAt: null } },
					contacts: { where: { deletedAt: null } }
				}
			}
		}
	});

	if (!vendor) {
		error(404, 'Vendor not found');
	}

	// If vendor is deleted and user is not admin, deny access
	if (vendor.deletedAt && !isAdmin) {
		error(403, 'Access denied');
	}

	// Calculate total expenses
	const totalExpenses = await prisma.expense.aggregate({
		where: {
			vendorId: vendorId,
			deletedAt: null
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
			isDeleted: vendor.deletedAt !== null,
			totalExpenses: Number(totalExpenses._sum.amount || 0)
		},
		isAdmin
	};
};

export const actions: Actions = {
	createContact: async ({ locals, request, params }) => {
		await requirePermission(locals, 'vendors', 'contacts');

		// Parse vendor ID
		const vendorId = parseInt(params.id);
		if (isNaN(vendorId)) {
			return fail(400, { error: 'Invalid vendor ID' });
		}

		const formData = await request.formData();
		const firstName = formData.get('firstName') as string;
		const lastName = formData.get('lastName') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;
		const mobile = formData.get('mobile') as string;
		const position = formData.get('position') as string;

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

		// Create contact
		const contact = await prisma.person.create({
			data: {
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				email: email?.trim() || null,
				phone: phone?.trim() || null,
				mobile: mobile?.trim() || null,
				position: position?.trim() || null,
				personType: 'vendor_contact',
				vendorId: vendorId
			}
		});

		await logCreate(locals.user!.id, 'vendors', String(contact.id), 'Person', {
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
		const vendorId = parseInt(params.id);
		if (isNaN(vendorId)) {
			return fail(400, { error: 'Invalid vendor ID' });
		}

		const formData = await request.formData();
		const contactIdStr = formData.get('contactId') as string;
		const firstName = formData.get('firstName') as string;
		const lastName = formData.get('lastName') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;
		const mobile = formData.get('mobile') as string;
		const position = formData.get('position') as string;

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
		const existingContact = await prisma.person.findFirst({
			where: {
				id: contactId,
				vendorId: vendorId,
				deletedAt: null
			}
		});

		if (!existingContact) {
			return fail(404, { error: 'Contact not found' });
		}

		// Update contact
		const updatedContact = await prisma.person.update({
			where: { id: contactId },
			data: {
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				email: email?.trim() || null,
				phone: phone?.trim() || null,
				mobile: mobile?.trim() || null,
				position: position?.trim() || null
			}
		});

		await logUpdate(locals.user!.id, 'vendors', String(contactId), 'Person', existingContact, {
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
		const vendorId = parseInt(params.id);
		if (isNaN(vendorId)) {
			return fail(400, { error: 'Invalid vendor ID' });
		}

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
		const contact = await prisma.person.findFirst({
			where: {
				id: contactId,
				vendorId: vendorId,
				deletedAt: null
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

		// Soft delete
		await prisma.person.update({
			where: { id: contactId },
			data: { deletedAt: new Date() }
		});

		await logDelete(locals.user!.id, 'vendors', String(contactId), 'Person', {
			firstName: contact.firstName,
			lastName: contact.lastName,
			email: contact.email
		});

		return { success: true };
	}
};
