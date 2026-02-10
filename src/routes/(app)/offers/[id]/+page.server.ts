import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { error, fail, redirect } from '@sveltejs/kit';
import { logDelete } from '$lib/server/audit';
import { parseId } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'offers', 'read');

	const id = parseId(params.id, 'offer');

	const offer = await prisma.offer.findUnique({
		where: { id },
		include: {
			client: {
				select: {
					id: true,
					name: true,
					email: true,
					companyName: true,
					phone: true
				}
			},
			options: {
				orderBy: { order: 'asc' },
				include: {
					items: {
						orderBy: { order: 'asc' },
						include: {
							priceListItem: { select: { id: true, name: true, active: true } }
						}
					}
				}
			},
			createdBy: { select: { id: true, name: true } }
		}
	});

	if (!offer) {
		throw error(404, 'Offer not found');
	}

	// Serialize Decimal fields
	const serialized = {
		...offer,
		subtotal: Number(offer.subtotal),
		taxTotal: Number(offer.taxTotal),
		grandTotal: Number(offer.grandTotal),
		discountValue: offer.discountValue ? Number(offer.discountValue) : null,
		options: offer.options.map((opt) => ({
			...opt,
			items: opt.items.map((item) => ({
				...item,
				quantity: Number(item.quantity),
				unitPrice: Number(item.unitPrice),
				discount: Number(item.discount),
				taxRate: Number(item.taxRate),
				subtotal: Number(item.subtotal),
				discountAmount: Number(item.discountAmount),
				taxAmount: Number(item.taxAmount),
				total: Number(item.total)
			}))
		}))
	};

	return { offer: serialized };
};

export const actions: Actions = {
	delete: async ({ locals, params }) => {
		await requirePermission(locals, 'offers', 'delete');

		const id = parseInt(params.id);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid offer ID' });
		}

		const offer = await prisma.offer.findUnique({
			where: { id },
			select: {
				id: true,
				offerNumber: true,
				clientName: true,
				grandTotal: true,
				status: true
			}
		});

		if (!offer) {
			return fail(404, { error: 'Offer not found' });
		}

		await logDelete(locals.user!.id, 'offers', String(id), 'Offer', {
			offerNumber: offer.offerNumber,
			clientName: offer.clientName,
			grandTotal: Number(offer.grandTotal),
			status: offer.status
		});

		await prisma.offer.delete({ where: { id } });

		throw redirect(303, '/offers');
	}
};
