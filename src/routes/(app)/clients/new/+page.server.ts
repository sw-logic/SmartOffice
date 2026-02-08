import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail, redirect } from '@sveltejs/kit';
import { logCreate } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'clients', 'create');

	return {};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		await requirePermission(locals, 'clients', 'create');

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

		// Get the company for the user (for now, use the first company or create a default)
		let company = await prisma.company.findFirst();
		if (!company) {
			company = await prisma.company.create({
				data: {
					name: 'Default Company',
					currency: 'USD'
				}
			});
		}

		// Create client
		const client = await prisma.client.create({
			data: {
				companyId: company.id,
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
				notes: notes?.trim() || null,
				createdById: locals.user!.id
			}
		});

		await logCreate(locals.user!.id, 'clients', String(client.id), 'Client', {
			name: client.name,
			companyName: client.companyName,
			email: client.email,
			status: client.status
		});

		redirect(303, `/clients/${client.id}`);
	}
};
