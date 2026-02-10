import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'offers', 'update');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		throw error(400, 'Invalid offer ID');
	}

	const [offer, clients, priceListItems] = await Promise.all([
		prisma.offer.findUnique({
			where: { id },
			include: {
				options: {
					orderBy: { order: 'asc' },
					include: {
						items: {
							orderBy: { order: 'asc' }
						}
					}
				}
			}
		}),
		prisma.client.findMany({
			where: { status: 'active' },
			select: {
				id: true,
				name: true,
				email: true,
				companyName: true,
				paymentTerms: true
			},
			orderBy: { name: 'asc' }
		}),
		prisma.priceListItem.findMany({
			where: { active: true },
			select: {
				id: true,
				name: true,
				description: true,
				sku: true,
				category: true,
				unitPrice: true,
				currency: true,
				unitOfMeasure: true,
				taxRate: true
			},
			orderBy: { name: 'asc' }
		})
	]);

	if (!offer) {
		throw error(404, 'Offer not found');
	}

	// Serialize Decimal fields
	const serializedOffer = {
		...offer,
		subtotal: Number(offer.subtotal),
		taxTotal: Number(offer.taxTotal),
		grandTotal: Number(offer.grandTotal),
		discountValue: offer.discountValue ? Number(offer.discountValue) : null,
		date: offer.date.toISOString(),
		validUntil: offer.validUntil.toISOString(),
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

	return {
		offer: serializedOffer,
		clients,
		priceListItems: priceListItems.map((p) => ({
			...p,
			unitPrice: Number(p.unitPrice),
			taxRate: p.taxRate ? Number(p.taxRate) : null
		}))
	};
};
