import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';

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

export const POST: RequestHandler = async ({ locals, request }) => {
	await requirePermission(locals, 'offers', 'create');

	const body = await request.json();

	// Validation
	if (!body.date) {
		return json({ error: 'Date is required' }, { status: 400 });
	}
	if (!body.validUntil) {
		return json({ error: 'Valid until date is required' }, { status: 400 });
	}
	if (!body.options || !Array.isArray(body.options) || body.options.length === 0) {
		return json({ error: 'At least one option is required' }, { status: 400 });
	}

	// Generate offer number: OFF-YYYY-NNN
	const year = new Date(body.date).getFullYear();
	const lastOffer = await prisma.offer.findFirst({
		where: {
			offerNumber: { startsWith: `OFF-${year}-` }
		},
		orderBy: { offerNumber: 'desc' },
		select: { offerNumber: true }
	});

	let seq = 1;
	if (lastOffer) {
		const parts = lastOffer.offerNumber.split('-');
		seq = parseInt(parts[2]) + 1;
	}
	const offerNumber = `OFF-${year}-${String(seq).padStart(3, '0')}`;

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

	// Build options with items and compute totals
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

	const offer = await prisma.offer.create({
		data: {
			offerNumber,
			title: body.title?.trim() || null,
			showGrandTotal: body.showGrandTotal !== false,
			date: new Date(body.date),
			validUntil: new Date(body.validUntil),
			clientId,
			clientName,
			clientEmail,
			clientCompanyName,
			clientAddress,
			status: body.status || 'draft',
			currency: body.currency || 'USD',
			subtotal: Math.round(offerSubtotal * 100) / 100,
			taxTotal: Math.round(offerTaxTotal * 100) / 100,
			grandTotal,
			discountType,
			discountValue,
			terms: body.terms?.trim() || null,
			notes: body.notes?.trim() || null,
			createdById: locals.user!.id,
			options: { create: optionsData }
		},
		include: {
			options: { include: { items: true } }
		}
	});

	await logCreate(locals.user!.id, 'offers', String(offer.id), 'Offer', {
		offerNumber: offer.offerNumber,
		clientName: offer.clientName,
		grandTotal: Number(offer.grandTotal),
		status: offer.status
	});

	return json({ offer: { ...offer, id: offer.id } }, { status: 201 });
};
