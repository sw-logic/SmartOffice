import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'offers', 'create');

	const clientIdParam = url.searchParams.get('clientId');

	const [clients, priceListItems] = await Promise.all([
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

	return {
		clients,
		priceListItems: priceListItems.map((p) => ({
			...p,
			unitPrice: Number(p.unitPrice),
			taxRate: p.taxRate ? Number(p.taxRate) : null
		})),
		preselectedClientId: clientIdParam ? parseInt(clientIdParam) : null
	};
};
