import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { logAction } from '$lib/server/audit';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'crm', 'read');

	const leads = await prisma.lead.findMany({
		orderBy: { order: 'asc' },
		select: {
			id: true,
			title: true,
			stage: true,
			order: true,
			clientName: true,
			budget: true,
			currency: true,
			deadline: true,
			assignedTo: {
				select: { id: true, firstName: true, lastName: true, image: true }
			}
		}
	});

	return {
		leads: leads.map((lead) => ({
			...lead,
			budget: lead.budget ? Number(lead.budget) : null
		})),
		canCreate: checkPermission(locals, 'crm', 'create'),
		canUpdate: checkPermission(locals, 'crm', 'update'),
		canDelete: checkPermission(locals, 'crm', 'delete')
	};
};

export const actions: Actions = {
	reorderLeads: async ({ locals, request }) => {
		await requirePermission(locals, 'crm', 'update');

		const formData = await request.formData();
		const updatesStr = formData.get('updates') as string;

		if (!updatesStr) {
			return fail(400, { error: 'Updates are required' });
		}

		let updates: Array<{ id: number; stage: string; order: number }>;
		try {
			updates = JSON.parse(updatesStr);
		} catch {
			return fail(400, { error: 'Invalid updates format' });
		}

		if (!Array.isArray(updates) || updates.length === 0) {
			return fail(400, { error: 'No updates provided' });
		}

		// Batch update all changed leads
		for (const update of updates) {
			await prisma.lead.update({
				where: { id: update.id },
				data: { stage: update.stage, order: update.order }
			});
		}

		await logAction({
			userId: locals.user!.id,
			action: 'updated',
			module: 'crm',
			entityType: 'Lead',
			newValues: { reordered: updates.length }
		});

		return { success: true };
	}
};
