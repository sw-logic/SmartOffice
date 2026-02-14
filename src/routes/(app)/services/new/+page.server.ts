import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';
import { generateServiceIncome } from '$lib/server/recurring';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requirePermission(locals, 'services', 'create');

	const preselectedClientId = url.searchParams.get('clientId');

	const [clients, employees] = await Promise.all([
		prisma.client.findMany({
			where: { status: 'active' },
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				contacts: {
					orderBy: [{ isPrimaryContact: 'desc' }, { lastName: 'asc' }],
					select: { id: true, firstName: true, lastName: true, position: true }
				}
			}
		}),
		prisma.user.findMany({
			where: { employeeStatus: 'active' },
			orderBy: { name: 'asc' },
			select: { id: true, name: true, firstName: true, lastName: true }
		})
	]);

	return { clients, employees, preselectedClientId };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		await requirePermission(locals, 'services', 'create');

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const type = formData.get('type') as string;
		const status = formData.get('status') as string;
		const clientIdStr = formData.get('clientId') as string;
		const contactIdStr = formData.get('contactId') as string;
		const assignedToIdStr = formData.get('assignedToId') as string;
		const monthlyFeeStr = formData.get('monthlyFee') as string;
		const currency = formData.get('currency') as string;
		const recurringPeriod = (formData.get('recurringPeriod') as string) || 'monthly';
		const taxRateStr = formData.get('taxRate') as string;
		const budgetedHoursStr = formData.get('budgetedHours') as string;
		const startDate = formData.get('startDate') as string;
		const endDate = formData.get('endDate') as string;

		if (!name?.trim()) {
			return fail(400, {
				error: 'Service name is required',
				values: { name, description, type, status, clientId: clientIdStr, contactId: contactIdStr, assignedToId: assignedToIdStr, monthlyFee: monthlyFeeStr, currency, recurringPeriod, taxRate: taxRateStr, budgetedHours: budgetedHoursStr, startDate, endDate }
			});
		}

		if (!clientIdStr) {
			return fail(400, {
				error: 'Client is required',
				values: { name, description, type, status, clientId: clientIdStr, contactId: contactIdStr, assignedToId: assignedToIdStr, monthlyFee: monthlyFeeStr, currency, recurringPeriod, taxRate: taxRateStr, budgetedHours: budgetedHoursStr, startDate, endDate }
			});
		}

		if (!startDate) {
			return fail(400, {
				error: 'Start date is required',
				values: { name, description, type, status, clientId: clientIdStr, contactId: contactIdStr, assignedToId: assignedToIdStr, monthlyFee: monthlyFeeStr, currency, recurringPeriod, taxRate: taxRateStr, budgetedHours: budgetedHoursStr, startDate, endDate }
			});
		}

		const clientId = parseInt(clientIdStr);
		const contactId = contactIdStr ? parseInt(contactIdStr) : null;
		const assignedToId = assignedToIdStr ? parseInt(assignedToIdStr) : null;
		const monthlyFee = monthlyFeeStr ? Number(monthlyFeeStr) : null;
		const taxRate = taxRateStr ? Number(taxRateStr) : null;
		const budgetedHours = budgetedHoursStr ? Math.round(Number(budgetedHoursStr)) : null;

		// Denormalize names
		let clientName: string | null = null;
		let contactName: string | null = null;

		if (clientId) {
			const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
			clientName = client?.name ?? null;
		}
		if (contactId) {
			const contact = await prisma.contact.findUnique({ where: { id: contactId }, select: { firstName: true, lastName: true } });
			contactName = contact ? `${contact.firstName} ${contact.lastName}` : null;
		}

		const service = await prisma.service.create({
			data: {
				name: name.trim(),
				description: description?.trim() || null,
				type: type || null,
				status: status || 'active',
				clientId,
				clientName,
				contactId,
				contactName,
				assignedToId,
				monthlyFee,
				currency: currency || 'HUF',
				recurringPeriod,
				taxRate,
				budgetedHours,
				startDate: new Date(startDate),
				endDate: endDate ? new Date(endDate) : null,
				createdById: locals.user!.id
			}
		});

		// Auto-generate recurring Income if monthly fee is set
		if (monthlyFee && monthlyFee > 0) {
			const incomeId = await generateServiceIncome(
				{
					id: service.id,
					name: service.name,
					monthlyFee: service.monthlyFee,
					currency: service.currency,
					recurringPeriod: service.recurringPeriod,
					taxRate: service.taxRate ? Number(service.taxRate) : null,
					clientId: service.clientId,
					clientName: service.clientName,
					startDate: service.startDate,
					endDate: service.endDate
				},
				locals.user!.id
			);

			await prisma.service.update({
				where: { id: service.id },
				data: { incomeId }
			});
		}

		await logCreate(locals.user!.id, 'services', String(service.id), 'Service', {
			name: service.name,
			clientName,
			type: service.type,
			monthlyFee: service.monthlyFee ? Number(service.monthlyFee) : null
		});

		redirect(303, `/services/${service.id}`);
	}
};
