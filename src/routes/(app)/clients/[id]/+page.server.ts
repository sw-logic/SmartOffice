import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { error, fail } from '@sveltejs/kit';
import { logCreate, logUpdate, logDelete } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'clients', 'read');

	// Parse client ID
	const clientId = parseInt(params.id);
	if (isNaN(clientId)) {
		error(400, 'Invalid client ID');
	}

	// Check if user is admin (can view deleted clients)
	const isAdmin = checkPermission(locals, '*', '*');

	const client = await prisma.client.findUnique({
		where: { id: clientId },
		include: {
			contacts: {
				where: { deletedAt: null },
				orderBy: [{ isPrimaryContact: 'desc' }, { lastName: 'asc' }],
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					phone: true,
					mobile: true,
					position: true,
					isPrimaryContact: true
				}
			},
			projects: {
				where: { deletedAt: null },
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
				where: { deletedAt: null },
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
			createdBy: {
				select: {
					id: true,
					name: true
				}
			},
			_count: {
				select: {
					projects: { where: { deletedAt: null } },
					contacts: { where: { deletedAt: null } },
					offers: { where: { deletedAt: null } },
					income: { where: { deletedAt: null } },
					payments: { where: { deletedAt: null } }
				}
			}
		}
	});

	if (!client) {
		error(404, 'Client not found');
	}

	// If client is deleted and user is not admin, deny access
	if (client.deletedAt && !isAdmin) {
		error(403, 'Access denied');
	}

	// Calculate total income
	const totalIncome = await prisma.income.aggregate({
		where: {
			clientId: clientId,
			deletedAt: null
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
			isDeleted: client.deletedAt !== null,
			totalIncome: Number(totalIncome._sum.amount || 0)
		},
		isAdmin
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

		// Validation
		if (!firstName?.trim()) {
			return fail(400, { error: 'First name is required' });
		}
		if (!lastName?.trim()) {
			return fail(400, { error: 'Last name is required' });
		}

		// Parse client ID
		const clientId = parseInt(params.id);
		if (isNaN(clientId)) {
			return fail(400, { error: 'Invalid client ID' });
		}

		// Verify client exists
		const client = await prisma.client.findUnique({
			where: { id: clientId },
			select: { id: true, name: true }
		});

		if (!client) {
			return fail(404, { error: 'Client not found' });
		}

		// If setting as primary, unset any existing primary contact
		if (isPrimaryContact) {
			await prisma.person.updateMany({
				where: {
					clientId: clientId,
					isPrimaryContact: true,
					deletedAt: null
				},
				data: { isPrimaryContact: false }
			});
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
				isPrimaryContact,
				personType: 'client_contact',
				clientId: clientId
			}
		});

		await logCreate(locals.user!.id, 'clients', String(contact.id), 'Person', {
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

		if (!contactIdStr) {
			return fail(400, { error: 'Contact ID is required' });
		}
		const contactId = parseInt(contactIdStr);
		if (isNaN(contactId)) {
			return fail(400, { error: 'Invalid contact ID' });
		}

		// Parse client ID
		const clientId = parseInt(params.id);
		if (isNaN(clientId)) {
			return fail(400, { error: 'Invalid client ID' });
		}

		if (!firstName?.trim()) {
			return fail(400, { error: 'First name is required' });
		}
		if (!lastName?.trim()) {
			return fail(400, { error: 'Last name is required' });
		}

		// Verify contact exists and belongs to this client
		const existingContact = await prisma.person.findFirst({
			where: {
				id: contactId,
				clientId: clientId,
				deletedAt: null
			}
		});

		if (!existingContact) {
			return fail(404, { error: 'Contact not found' });
		}

		// If setting as primary, unset any existing primary contact
		if (isPrimaryContact && !existingContact.isPrimaryContact) {
			await prisma.person.updateMany({
				where: {
					clientId: clientId,
					isPrimaryContact: true,
					deletedAt: null,
					id: { not: contactId }
				},
				data: { isPrimaryContact: false }
			});
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
				position: position?.trim() || null,
				isPrimaryContact
			}
		});

		await logUpdate(locals.user!.id, 'clients', String(contactId), 'Person', existingContact, {
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

		// Parse client ID
		const clientId = parseInt(params.id);
		if (isNaN(clientId)) {
			return fail(400, { error: 'Invalid client ID' });
		}

		// Verify contact exists and belongs to this client
		const contact = await prisma.person.findFirst({
			where: {
				id: contactId,
				clientId: clientId,
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

		await logDelete(locals.user!.id, 'clients', String(contactId), 'Person', {
			firstName: contact.firstName,
			lastName: contact.lastName,
			email: contact.email
		});

		return { success: true };
	}
};
