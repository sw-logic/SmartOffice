import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail, redirect, error } from '@sveltejs/kit';
import { logUpdate } from '$lib/server/audit';
import { parseId } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'vendors', 'update');

	// Parse vendor ID
	const vendorId = parseId(params.id, 'vendor');

	const vendor = await prisma.vendor.findUnique({
		where: { id: vendorId },
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
			category: true,
			status: true,
			paymentTerms: true,
			currency: true,
			notes: true
		}
	});

	if (!vendor) {
		error(404, 'Vendor not found');
	}

	return {
		vendor
	};
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		await requirePermission(locals, 'vendors', 'update');

		// Parse vendor ID
		const vendorId = parseId(params.id, 'vendor');

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

		// Get old values for audit
		const oldVendor = await prisma.vendor.findUnique({
			where: { id: vendorId },
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
				category: true,
				status: true,
				paymentTerms: true,
				currency: true,
				notes: true
			}
		});

		// Update vendor
		const updatedVendor = await prisma.vendor.update({
			where: { id: vendorId },
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

		await logUpdate(
			locals.user!.id,
			'vendors',
			String(vendorId),
			'Vendor',
			oldVendor || {},
			{
				name: updatedVendor.name,
				companyName: updatedVendor.companyName,
				email: updatedVendor.email,
				phone: updatedVendor.phone,
				website: updatedVendor.website,
				street: updatedVendor.street,
				city: updatedVendor.city,
				postalCode: updatedVendor.postalCode,
				country: updatedVendor.country,
				taxId: updatedVendor.taxId,
				vatNumber: updatedVendor.vatNumber,
				category: updatedVendor.category,
				status: updatedVendor.status,
				paymentTerms: updatedVendor.paymentTerms,
				currency: updatedVendor.currency,
				notes: updatedVendor.notes
			}
		);

		redirect(303, `/vendors/${params.id}`);
	}
};
