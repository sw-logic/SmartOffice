import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logUpdate, logDelete } from '$lib/server/audit';

function computeItemFields(item: {
	quantity: number;
	unitPrice: number;
	discount: number;
	taxRate: number;
}) {
	const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
	const discountAmount = Math.round(subtotal * (item.discount / 100) * 100) / 100;
	const taxAmount = Math.round((subtotal - discountAmount) * (item.taxRate / 100) * 100) / 100;
	const total = Math.round((subtotal - discountAmount + taxAmount) * 100) / 100;
	return { subtotal, discountAmount, taxAmount, total };
}

function serializeOffer(offer: any) {
	return {
		...offer,
		subtotal: Number(offer.subtotal),
		taxTotal: Number(offer.taxTotal),
		grandTotal: Number(offer.grandTotal),
		discountValue: offer.discountValue ? Number(offer.discountValue) : null,
		options: offer.options?.map((opt: any) => ({
			...opt,
			items: opt.items?.map((item: any) => ({
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
}

export const GET: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'offers', 'read');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid offer ID' }, { status: 400 });
	}

	const offer = await prisma.offer.findUnique({
		where: { id },
		include: {
			client: { select: { id: true, name: true, email: true, companyName: true } },
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
		return json({ error: 'Offer not found' }, { status: 404 });
	}

	return json({ offer: serializeOffer(offer) });
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	await requirePermission(locals, 'offers', 'update');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid offer ID' }, { status: 400 });
	}

	const existing = await prisma.offer.findUnique({
		where: { id },
		select: {
			id: true,
			offerNumber: true,
			title: true,
			showGrandTotal: true,
			status: true,
			clientId: true,
			clientName: true,
			grandTotal: true
		}
	});

	if (!existing) {
		return json({ error: 'Offer not found' }, { status: 404 });
	}

	const body = await request.json();

	if (!body.date) {
		return json({ error: 'Date is required' }, { status: 400 });
	}
	if (!body.validUntil) {
		return json({ error: 'Valid until date is required' }, { status: 400 });
	}
	if (!body.options || !Array.isArray(body.options) || body.options.length === 0) {
		return json({ error: 'At least one option is required' }, { status: 400 });
	}

	// Snapshot client info
	let clientName: string | null = null;
	let clientEmail: string | null = null;
	let clientCompanyName: string | null = null;
	let clientAddress: string | null = null;
	const clientId = body.clientId ? parseInt(body.clientId) : null;

	if (clientId) {
		const client = await prisma.client.findUnique({
			where: { id: clientId },
			select: {
				name: true,
				email: true,
				companyName: true,
				street: true,
				city: true,
				postalCode: true,
				country: true
			}
		});
		if (client) {
			clientName = client.name;
			clientEmail = client.email;
			clientCompanyName = client.companyName;
			const addressParts = [client.street, client.city, client.postalCode, client.country].filter(Boolean);
			clientAddress = addressParts.length > 0 ? addressParts.join(', ') : null;
		}
	}

	// Compute totals from options/items
	let offerSubtotal = 0;
	let offerTaxTotal = 0;

	const optionsData = body.options.map((opt: any, optIndex: number) => {
		const itemsData = (opt.items || []).map((item: any, itemIndex: number) => {
			const qty = parseFloat(item.quantity) || 0;
			const price = parseFloat(item.unitPrice) || 0;
			const disc = parseFloat(item.discount) || 0;
			const tax = parseFloat(item.taxRate) || 0;
			const computed = computeItemFields({ quantity: qty, unitPrice: price, discount: disc, taxRate: tax });

			offerSubtotal += computed.subtotal - computed.discountAmount;
			offerTaxTotal += computed.taxAmount;

			return {
				priceListItemId: item.priceListItemId ? parseInt(item.priceListItemId) : null,
				name: item.name || 'Unnamed Item',
				description: item.description || null,
				sku: item.sku || null,
				unitOfMeasure: item.unitOfMeasure || 'piece',
				quantity: qty,
				unitPrice: price,
				discount: disc,
				taxRate: tax,
				subtotal: computed.subtotal,
				discountAmount: computed.discountAmount,
				taxAmount: computed.taxAmount,
				total: computed.total,
				order: itemIndex
			};
		});

		return {
			name: opt.name || `Option ${optIndex + 1}`,
			description: opt.description || null,
			order: optIndex,
			items: { create: itemsData }
		};
	});

	// Apply global discount
	const discountType = body.discountType || null;
	const discountValue = body.discountValue ? parseFloat(body.discountValue) : null;
	let grandTotal = offerSubtotal + offerTaxTotal;

	if (discountType && discountValue) {
		if (discountType === 'percentage') {
			grandTotal -= Math.round(grandTotal * (discountValue / 100) * 100) / 100;
		} else if (discountType === 'fixed') {
			grandTotal -= discountValue;
		}
	}
	grandTotal = Math.round(grandTotal * 100) / 100;

	// Delete-and-recreate strategy: delete old options (cascades to items), create new ones
	const offer = await prisma.$transaction(async (tx) => {
		await tx.offerOption.deleteMany({ where: { offerId: id } });

		return tx.offer.update({
			where: { id },
			data: {
				title: body.title?.trim() || null,
				showGrandTotal: body.showGrandTotal !== false,
				date: new Date(body.date),
				validUntil: new Date(body.validUntil),
				clientId,
				clientName,
				clientEmail,
				clientCompanyName,
				clientAddress,
				status: body.status || existing.status,
				currency: body.currency || 'USD',
				subtotal: Math.round(offerSubtotal * 100) / 100,
				taxTotal: Math.round(offerTaxTotal * 100) / 100,
				grandTotal,
				discountType,
				discountValue,
				terms: body.terms?.trim() || null,
				notes: body.notes?.trim() || null,
				options: { create: optionsData }
			},
			include: {
				options: { include: { items: true } }
			}
		});
	});

	await logUpdate(locals.user!.id, 'offers', String(id), 'Offer', {
		clientId: existing.clientId,
		clientName: existing.clientName,
		grandTotal: Number(existing.grandTotal),
		status: existing.status
	}, {
		clientId: offer.clientId,
		clientName: offer.clientName,
		grandTotal: Number(offer.grandTotal),
		status: offer.status
	});

	return json({ offer: serializeOffer(offer) });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'offers', 'delete');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid offer ID' }, { status: 400 });
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
		return json({ error: 'Offer not found' }, { status: 404 });
	}

	// Log BEFORE hard delete
	await logDelete(locals.user!.id, 'offers', String(id), 'Offer', {
		offerNumber: offer.offerNumber,
		clientName: offer.clientName,
		grandTotal: Number(offer.grandTotal),
		status: offer.status
	});

	// Cascades to options and items
	await prisma.offer.delete({ where: { id } });

	return json({ success: true });
};
