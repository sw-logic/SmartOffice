import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { parseId } from '$lib/server/crud-helpers';
import { error, fail } from '@sveltejs/kit';
import { logCreate, logUpdate, logDelete } from '$lib/server/audit';
import { saveAvatar, deleteFile } from '$lib/server/file-upload';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'clients', 'read');

	const clientId = parseId(params.id, 'client');

	const canViewOffers = checkPermission(locals, 'offers', 'read');
	const canViewIncome = checkPermission(locals, 'finances.income', 'read');
	const canViewExpenses = checkPermission(locals, 'finances.expenses', 'read');

	const [client, boards, tasks, expenses, totalIncome] = await Promise.all([
		prisma.client.findUnique({
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
					take: 10,
					select: {
						id: true,
						name: true,
						status: true,
						startDate: true,
						endDate: true
					}
				},
				offers: canViewOffers ? {
					orderBy: { createdAt: 'desc' },
					take: 10,
					select: {
						id: true,
						offerNumber: true,
						status: true,
						grandTotal: true,
						currency: true,
						date: true
					}
				} : false,
				income: canViewIncome ? {
					orderBy: { date: 'desc' },
					take: 10,
					select: {
						id: true,
						amount: true,
						currency: true,
						date: true,
						description: true,
						category: true,
						status: true
					}
				} : false,
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
		}),
		// Boards through projects
		prisma.kanbanBoard.findMany({
			where: { project: { clientId } },
			orderBy: { createdAt: 'desc' },
			take: 10,
			select: {
				id: true,
				name: true,
				description: true,
				project: { select: { id: true, name: true } },
				_count: { select: { members: true, tasks: true } }
			}
		}),
		// Tasks through projects (exclude completed)
		prisma.task.findMany({
			where: { project: { clientId }, status: { not: 'done' } },
			orderBy: { createdAt: 'desc' },
			take: 10,
			select: {
				id: true,
				name: true,
				status: true,
				priority: true,
				dueDate: true,
				project: { select: { id: true, name: true } },
				assignedTo: {
					select: { id: true, firstName: true, lastName: true, image: true }
				}
			}
		}),
		// Expenses through projects
		canViewExpenses
			? prisma.expense.findMany({
					where: { project: { clientId } },
					orderBy: { date: 'desc' },
					take: 10,
					select: {
						id: true,
						amount: true,
						currency: true,
						date: true,
						description: true,
						category: true,
						status: true,
						vendorName: true,
						vendor: { select: { id: true, name: true } }
					}
				})
			: Promise.resolve([]),
		// Total income
		prisma.income.aggregate({
			where: { clientId },
			_sum: { amount: true }
		})
	]);

	if (!client) {
		error(404, 'Client not found');
	}

	// Counts for boards, tasks, expenses (through projects)
	const projectIds = await prisma.project.findMany({
		where: { clientId },
		select: { id: true }
	});
	const pIds = projectIds.map(p => p.id);

	const [boardCount, taskCount, expenseCount] = await Promise.all([
		prisma.kanbanBoard.count({ where: { projectId: { in: pIds } } }),
		prisma.task.count({ where: { projectId: { in: pIds }, status: { not: 'done' } } }),
		canViewExpenses
			? prisma.expense.count({ where: { projectId: { in: pIds } } })
			: Promise.resolve(0)
	]);

	return {
		client: {
			...client,
			contacts: client.contacts,
			projects: client.projects,
			offers: canViewOffers
				? (client.offers as Array<{ id: number; offerNumber: string; status: string; grandTotal: unknown; currency: string; date: Date }>).map(offer => ({
						...offer,
						grandTotal: Number(offer.grandTotal)
					}))
				: [],
			income: canViewIncome
				? (client.income as Array<{ id: number; amount: unknown; currency: string; date: Date; description: string; category: string; status: string }>).map(inc => ({
						...inc,
						amount: Number(inc.amount)
					}))
				: [],
			_count: client._count,
			createdBy: client.createdBy,
			totalIncome: Number(totalIncome._sum.amount || 0)
		},
		boards,
		boardCount,
		tasks,
		taskCount,
		expenses: expenses.map(exp => ({
			...exp,
			amount: Number(exp.amount)
		})),
		expenseCount,
		canViewOffers,
		canViewIncome,
		canViewExpenses
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
