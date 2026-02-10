import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'offers', 'read');

	const search = url.searchParams.get('search') || '';
	const status = url.searchParams.get('status') || '';
	const clientId = url.searchParams.get('clientId') || '';
	const sortBy = url.searchParams.get('sortBy') || 'date';
	const sortOrder = url.searchParams.get('sortOrder') || 'desc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = 50;

	// Build where clause
	const where: any = {};

	if (search) {
		where.OR = [
			{ offerNumber: { contains: search, mode: 'insensitive' } },
			{ title: { contains: search, mode: 'insensitive' } },
			{ clientName: { contains: search, mode: 'insensitive' } },
			{ notes: { contains: search, mode: 'insensitive' } }
		];
	}

	if (status) {
		where.status = status;
	}

	if (clientId) {
		where.clientId = parseInt(clientId);
	}

	// Build orderBy
	const orderBy: any = {};
	if (sortBy === 'client') {
		orderBy.clientName = sortOrder;
	} else {
		orderBy[sortBy] = sortOrder;
	}

	const totalCount = await prisma.offer.count({ where });

	const offers = await prisma.offer.findMany({
		where,
		select: {
			id: true,
			offerNumber: true,
			title: true,
			date: true,
			validUntil: true,
			clientId: true,
			clientName: true,
			status: true,
			currency: true,
			subtotal: true,
			taxTotal: true,
			grandTotal: true,
			discountType: true,
			discountValue: true,
			client: { select: { id: true, name: true } },
			_count: { select: { options: true } }
		},
		orderBy,
		skip: (page - 1) * pageSize,
		take: pageSize
	});

	const clients = await prisma.client.findMany({
		select: { id: true, name: true },
		orderBy: { name: 'asc' }
	});

	const serializedOffers = offers.map((o) => ({
		...o,
		subtotal: Number(o.subtotal),
		taxTotal: Number(o.taxTotal),
		grandTotal: Number(o.grandTotal),
		discountValue: o.discountValue ? Number(o.discountValue) : null
	}));

	// Summary
	const summaryData = await prisma.offer.aggregate({
		where,
		_sum: { grandTotal: true },
		_count: true
	});

	return {
		offers: serializedOffers,
		clients,
		summary: {
			totalAmount: summaryData._sum.grandTotal ? Number(summaryData._sum.grandTotal) : 0,
			count: summaryData._count
		},
		totalCount,
		page,
		pageSize,
		totalPages: Math.ceil(totalCount / pageSize),
		filters: {
			search,
			status,
			clientId,
			sortBy,
			sortOrder
		}
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		await requirePermission(locals, 'offers', 'delete');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Offer ID is required' });
		}
		const id = parseInt(idStr);
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

		return { success: true };
	},

	bulkDelete: async ({ locals, request }) => {
		await requirePermission(locals, 'offers', 'delete');

		const formData = await request.formData();
		const idsStr = formData.get('ids') as string;

		if (!idsStr) {
			return fail(400, { error: 'Offer IDs are required' });
		}

		const ids = idsStr.split(',').map(Number).filter((id) => !isNaN(id));
		if (ids.length === 0) {
			return fail(400, { error: 'No valid offer IDs provided' });
		}

		const offers = await prisma.offer.findMany({
			where: { id: { in: ids } },
			select: {
				id: true,
				offerNumber: true,
				clientName: true,
				grandTotal: true,
				status: true
			}
		});

		if (offers.length === 0) {
			return fail(404, { error: 'No offers found' });
		}

		for (const offer of offers) {
			await logDelete(locals.user!.id, 'offers', String(offer.id), 'Offer', {
				offerNumber: offer.offerNumber,
				clientName: offer.clientName,
				grandTotal: Number(offer.grandTotal),
				status: offer.status
			});
		}

		await prisma.offer.deleteMany({
			where: { id: { in: offers.map((o) => o.id) } }
		});

		return { success: true, count: offers.length };
	}
};
