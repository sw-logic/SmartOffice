import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { parseListParams, buildPagination, createDeleteAction, createBulkDeleteAction } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'offers', 'read');

	const { search, sortBy, sortOrder, page, limit } = parseListParams(url, { sortBy: 'date', sortOrder: 'desc', limit: 50 });
	const status = url.searchParams.get('status') || '';
	const clientId = url.searchParams.get('clientId') || '';

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
		skip: (page - 1) * limit,
		take: limit
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
		pageSize: limit,
		totalPages: Math.ceil(totalCount / limit),
		filters: {
			search,
			status,
			clientId,
			sortBy,
			sortOrder
		}
	};
};

const offerFindSelect = { id: true, offerNumber: true, clientName: true, grandTotal: true, status: true };
const offerAuditValues = (record: any) => ({
	offerNumber: record.offerNumber,
	clientName: record.clientName,
	grandTotal: Number(record.grandTotal),
	status: record.status
});

export const actions: Actions = {
	delete: createDeleteAction({
		permission: ['offers', 'delete'],
		module: 'offers',
		entityType: 'Offer',
		model: 'offer',
		findSelect: offerFindSelect,
		auditValues: offerAuditValues
	}),

	bulkDelete: createBulkDeleteAction({
		permission: ['offers', 'delete'],
		module: 'offers',
		entityType: 'Offer',
		model: 'offer',
		findSelect: offerFindSelect,
		auditValues: offerAuditValues
	})
};
