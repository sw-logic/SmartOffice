import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail, redirect, error } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'clients', 'update');

	// Check if current user is admin (can edit deleted clients)
	const isAdmin = checkPermission(locals, '*', '*');

	const clientId = parseInt(params.id);
	if (isNaN(clientId)) {
		error(400, 'Invalid client ID');
	}

	const client = await prisma.client.findUnique({
		where: { id: clientId },
		select: {
			id: true,
			name: true,
			companyName: true,
			email: true,
			phone: true,
			website: true,
			street: true,
			city: true,
			postalCode: true,
			country: true,
			taxId: true,
			vatNumber: true,
			industry: true,
			status: true,
			paymentTerms: true,
			currency: true,
			notes: true,
			deletedAt: true
		}
	});

	if (!client) {
		error(404, 'Client not found');
	}

	// If client is deleted and user is not admin, deny access
	if (client.deletedAt && !isAdmin) {
		error(403, 'Only administrators can edit deleted clients');
	}

	return {
		client: {
			...client,
			isDeleted: client.deletedAt !== null
		},
		isAdmin
	};
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		await requirePermission(locals, 'clients', 'update');

		const formData = await request.formData();

		const name = formData.get('name') as string;
		const companyName = formData.get('companyName') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;
		const website = formData.get('website') as string;
		const street = formData.get('street') as string;
		const city = formData.get('city') as string;
		const postalCode = formData.get('postalCode') as string;
		const country = formData.get('country') as string;
		const taxId = formData.get('taxId') as string;
		const vatNumber = formData.get('vatNumber') as string;
		const industry = formData.get('industry') as string;
		const status = formData.get('status') as string || 'active';
		const paymentTerms = parseInt(formData.get('paymentTerms') as string) || 30;
		const currency = formData.get('currency') as string || 'USD';
		const notes = formData.get('notes') as string;

		// Validation
		const errors: Record<string, string> = {};

		if (!name?.trim()) {
			errors.name = 'Client name is required';
		}

		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			errors.email = 'Please enter a valid email address';
		}

		if (website && !/^https?:\/\/.+/.test(website)) {
			errors.website = 'Please enter a valid URL (starting with http:// or https://)';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, {
				errors,
				values: {
					name,
					companyName,
					email,
					phone,
					website,
					street,
					city,
					postalCode,
					country,
					taxId,
					vatNumber,
					industry,
					status,
					paymentTerms,
					currency,
					notes
				}
			});
		}

		const clientId = parseInt(params.id);

		// Get old values for audit
		const oldClient = await prisma.client.findUnique({
			where: { id: clientId },
			select: {
				name: true,
				companyName: true,
				email: true,
				phone: true,
				website: true,
				street: true,
				city: true,
				postalCode: true,
				country: true,
				taxId: true,
				vatNumber: true,
				industry: true,
				status: true,
				paymentTerms: true,
				currency: true,
				notes: true
			}
		});

		// Update client
		const updatedClient = await prisma.client.update({
			where: { id: clientId },
			data: {
				name: name.trim(),
				companyName: companyName?.trim() || null,
				email: email?.trim() || null,
				phone: phone?.trim() || null,
				website: website?.trim() || null,
				street: street?.trim() || null,
				city: city?.trim() || null,
				postalCode: postalCode?.trim() || null,
				country: country?.trim() || null,
				taxId: taxId?.trim() || null,
				vatNumber: vatNumber?.trim() || null,
				industry: industry || null,
				status,
				paymentTerms,
				currency,
				notes: notes?.trim() || null
			}
		});

		await logUpdate(
			locals.user!.id,
			'clients',
			String(clientId),
			'Client',
			oldClient || {},
			{
				name: updatedClient.name,
				companyName: updatedClient.companyName,
				email: updatedClient.email,
				phone: updatedClient.phone,
				website: updatedClient.website,
				street: updatedClient.street,
				city: updatedClient.city,
				postalCode: updatedClient.postalCode,
				country: updatedClient.country,
				taxId: updatedClient.taxId,
				vatNumber: updatedClient.vatNumber,
				industry: updatedClient.industry,
				status: updatedClient.status,
				paymentTerms: updatedClient.paymentTerms,
				currency: updatedClient.currency,
				notes: updatedClient.notes
			}
		);

		redirect(303, `/clients/${clientId}`);
	}
};
