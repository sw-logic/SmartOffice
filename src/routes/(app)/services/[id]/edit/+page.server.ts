import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { parseId } from '$lib/server/crud-helpers';
import { logUpdate } from '$lib/server/audit';
import { generateServiceIncome, generateIncomeOccurrences } from '$lib/server/recurring';
import { error, fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'services', 'update');

	const serviceId = parseId(params.id, 'service');

	const [service, clients, employees] = await Promise.all([
		prisma.service.findUnique({
			where: { id: serviceId },
			include: {
				client: { select: { id: true, name: true } },
				contact: { select: { id: true, firstName: true, lastName: true } }
			}
		}),
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

	if (!service) {
		error(404, 'Service not found');
	}

	return {
		service: {
			...service,
			monthlyFee: service.monthlyFee ? Number(service.monthlyFee) : null,
			taxRate: service.taxRate ? Number(service.taxRate) : null
		},
		clients,
		employees
	};
};

export const actions: Actions = {
	default: async ({ locals, request, params }) => {
		await requirePermission(locals, 'services', 'update');

		const serviceId = parseId(params.id, 'service');

		const existing = await prisma.service.findUnique({
			where: { id: serviceId },
			select: {
				id: true, name: true, description: true, type: true, status: true,
				clientId: true, clientName: true, contactId: true, contactName: true,
				assignedToId: true, monthlyFee: true, currency: true, recurringPeriod: true,
				taxRate: true, budgetedHours: true,
				startDate: true, endDate: true, incomeId: true
			}
		});

		if (!existing) {
			error(404, 'Service not found');
		}

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
			return fail(400, { error: 'Service name is required' });
		}

		if (!clientIdStr) {
			return fail(400, { error: 'Client is required' });
		}

		if (!startDate) {
			return fail(400, { error: 'Start date is required' });
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

		const oldValues = {
			name: existing.name,
			description: existing.description,
			type: existing.type,
			status: existing.status,
			clientId: existing.clientId,
			contactId: existing.contactId,
			assignedToId: existing.assignedToId,
			monthlyFee: existing.monthlyFee ? Number(existing.monthlyFee) : null,
			currency: existing.currency,
			recurringPeriod: existing.recurringPeriod,
			taxRate: existing.taxRate ? Number(existing.taxRate) : null,
			budgetedHours: existing.budgetedHours,
			startDate: existing.startDate,
			endDate: existing.endDate
		};

		let incomeId = existing.incomeId;
		const oldFee = existing.monthlyFee ? Number(existing.monthlyFee) : null;
		const newFee = monthlyFee;

		// Handle linked income changes
		if (oldFee && !newFee && incomeId) {
			// Fee removed — delete linked income parent (cascade deletes children)
			await prisma.income.delete({ where: { id: incomeId } }).catch(() => {});
			incomeId = null;
		} else if (!oldFee && newFee && newFee > 0) {
			// Fee added — create new recurring income
			incomeId = await generateServiceIncome(
				{
					id: serviceId,
					name: name.trim(),
					monthlyFee: newFee,
					currency: currency || 'HUF',
					recurringPeriod,
					taxRate,
					clientId,
					clientName,
					startDate: new Date(startDate),
					endDate: endDate ? new Date(endDate) : null
				},
				locals.user!.id
			);
		} else if (incomeId && newFee && newFee > 0) {
			// Fee/dates changed — update linked income parent and regenerate
			const incomeTaxRate = taxRate ?? 0;
			const incomeTaxValue = incomeTaxRate > 0 ? Math.round(newFee * incomeTaxRate) / 100 : 0;
			await prisma.income.update({
				where: { id: incomeId },
				data: {
					amount: newFee,
					tax: incomeTaxValue,
					tax_value: incomeTaxValue,
					taxRate: incomeTaxRate > 0 ? incomeTaxRate : null,
					currency: currency || 'HUF',
					recurringPeriod,
					date: new Date(startDate),
					recurringEndDate: endDate ? new Date(endDate) : null,
					description: name.trim(),
					clientId,
					clientName
				}
			});
			if (endDate) {
				await generateIncomeOccurrences(incomeId, locals.user!.id);
			} else {
				// No end date — delete projected children
				await prisma.income.deleteMany({
					where: { parentId: incomeId, status: 'projected' }
				});
			}
		}

		await prisma.service.update({
			where: { id: serviceId },
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
				incomeId
			}
		});

		await logUpdate(locals.user!.id, 'services', String(serviceId), 'Service', oldValues, {
			name: name.trim(),
			type,
			status,
			clientId,
			contactId,
			assignedToId,
			recurringPeriod,
			taxRate,
			monthlyFee,
			currency,
			budgetedHours,
			startDate,
			endDate
		});

		redirect(303, `/services/${serviceId}`);
	}
};
