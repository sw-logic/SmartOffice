import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail, redirect } from '@sveltejs/kit';
import { logCreate } from '$lib/server/audit';
import { getEnumValuesBatch } from '$lib/server/enums';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'vendors', 'create');

	// Get enum values from database
	const enums = await getEnumValuesBatch(['vendor_category', 'currency', 'entity_status']);

	return {
		categories: enums.vendor_category,
		currencies: enums.currency,
		statuses: enums.entity_status
	};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		await requirePermission(locals, 'vendors', 'create');

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
		const category = formData.get('category') as string;
		const status = formData.get('status') as string || 'active';
		const paymentTerms = parseInt(formData.get('paymentTerms') as string) || 30;
		const currency = formData.get('currency') as string || 'USD';
		const notes = formData.get('notes') as string;

		// Validation
		const errors: Record<string, string> = {};

		if (!name?.trim()) {
			errors.name = 'Vendor name is required';
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
					category,
					status,
					paymentTerms,
					currency,
					notes
				}
			});
		}

		// Create vendor
		const vendor = await prisma.vendor.create({
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
				category: category || null,
				status,
				paymentTerms,
				currency,
				notes: notes?.trim() || null
			}
		});

		await logCreate(locals.user!.id, 'vendors', String(vendor.id), 'Vendor', {
			name: vendor.name,
			companyName: vendor.companyName,
			email: vendor.email,
			category: vendor.category,
			status: vendor.status
		});

		redirect(303, `/vendors/${vendor.id}`);
	}
};
