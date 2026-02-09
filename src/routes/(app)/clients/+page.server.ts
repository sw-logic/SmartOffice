import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'clients', 'read');

	const search = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '10');
	const status = url.searchParams.get('status') || 'active'; // 'active', 'inactive', 'archived'

	// Build where clause based on status filter
	type WhereClause = {
		status?: string;
		OR?: Array<{
			name?: { contains: string; mode: 'insensitive' };
			companyName?: { contains: string; mode: 'insensitive' };
			email?: { contains: string; mode: 'insensitive' };
		}>;
	};

	let where: WhereClause = {};

	if (status === 'active' || status === 'inactive' || status === 'archived') {
		where.status = status;
	} else {
		// Default: show active clients
		where.status = 'active';
	}

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: 'insensitive' } },
			{ companyName: { contains: search, mode: 'insensitive' } },
			{ email: { contains: search, mode: 'insensitive' } }
		];
	}

	const [clients, total] = await Promise.all([
		prisma.client.findMany({
			where,
			orderBy: { [sortBy]: sortOrder },
			skip: (page - 1) * limit,
			take: limit,
			select: {
				id: true,
				name: true,
				companyName: true,
				email: true,
				phone: true,
				city: true,
				country: true,
				status: true,
				industry: true,
				createdAt: true,
				_count: {
					select: {
						projects: true,
						contacts: true
					}
				}
			}
		}),
		prisma.client.count({ where })
	]);

	return {
		clients: clients.map(client => ({
			...client,
			projectCount: client._count.projects,
			contactCount: client._count.contacts
		})),
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit)
		},
		filters: {
			search,
			sortBy,
			sortOrder,
			status
		}
	};
};

export const actions: Actions = {
	delete: async ({ locals, request }) => {
		await requirePermission(locals, 'clients', 'delete');

		const formData = await request.formData();
		const idStr = formData.get('id') as string;

		if (!idStr) {
			return fail(400, { error: 'Client ID is required' });
		}

		const id = parseInt(idStr);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid client ID' });
		}

		const client = await prisma.client.findUnique({
			where: { id },
			select: { id: true, name: true, companyName: true }
		});

		if (!client) {
			return fail(404, { error: 'Client not found' });
		}

		// Log before hard delete
		await logDelete(locals.user!.id, 'clients', String(id), 'Client', {
			name: client.name,
			companyName: client.companyName
		});

		await prisma.client.delete({
			where: { id }
		});

		return { success: true };
	}
};
