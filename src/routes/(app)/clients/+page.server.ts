import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { fail } from '@sveltejs/kit';
import { logDelete, logAction } from '$lib/server/audit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'clients', 'read');

	// Check if user is admin (can see deleted clients)
	const isAdmin = checkPermission(locals, '*', '*');

	const search = url.searchParams.get('search') || '';
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '10');
	const status = url.searchParams.get('status') || 'active'; // 'all', 'active', 'inactive', 'archived', 'deleted'

	// Build where clause based on status filter
	type WhereClause = {
		deletedAt?: null | { not: null };
		status?: string;
		OR?: Array<{
			name?: { contains: string; mode: 'insensitive' };
			companyName?: { contains: string; mode: 'insensitive' };
			email?: { contains: string; mode: 'insensitive' };
		}>;
	};

	let where: WhereClause = {};

	if (status === 'deleted' && isAdmin) {
		where.deletedAt = { not: null };
	} else if (status === 'all' && isAdmin) {
		// Show all records including deleted — explicitly mark deletedAt as handled
		// so the soft-delete extension doesn't auto-filter
		where.deletedAt = undefined as any;
	} else if (status === 'active' || status === 'inactive' || status === 'archived') {
		where.deletedAt = null;
		where.status = status;
	} else {
		// Default: show active clients
		where.deletedAt = null;
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
				deletedAt: true,
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
		},
		isAdmin
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

		// Soft delete
		await prisma.client.update({
			where: { id },
			data: { deletedAt: new Date() }
		});

		await logDelete(locals.user!.id, 'clients', String(id), 'Client', {
			name: client.name,
			companyName: client.companyName
		});

		return { success: true };
	},

	restore: async ({ locals, request }) => {
		await requirePermission(locals, 'clients', 'update');

		// Only admins can restore clients
		const isAdmin = checkPermission(locals, '*', '*');
		if (!isAdmin) {
			return fail(403, { error: 'Only administrators can restore deleted clients' });
		}

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
			select: { id: true, name: true, deletedAt: true }
		});

		if (!client) {
			return fail(404, { error: 'Client not found' });
		}

		if (!client.deletedAt) {
			return fail(400, { error: 'Client is not deleted' });
		}

		// Restore client
		await prisma.client.update({
			where: { id },
			data: { deletedAt: null }
		});

		await logAction({
			userId: locals.user!.id,
			action: 'restored',
			module: 'clients',
			entityId: String(id),
			entityType: 'Client',
			oldValues: { deletedAt: client.deletedAt },
			newValues: { deletedAt: null }
		});

		return { success: true };
	}
};
