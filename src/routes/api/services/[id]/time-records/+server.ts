import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';
import { recalcServiceSpentTime } from '$lib/server/time-records';

const timeRecordSelect = {
	id: true,
	date: true,
	minutes: true,
	description: true,
	type: true,
	category: true,
	billable: true,
	userId: true,
	user: {
		select: { id: true, firstName: true, lastName: true }
	},
	createdById: true,
	createdBy: {
		select: { id: true, name: true }
	},
	createdAt: true
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	await requirePermission(locals, 'services', 'update');

	const serviceId = parseInt(params.id);
	if (isNaN(serviceId)) {
		return json({ error: 'Invalid service ID' }, { status: 400 });
	}

	const service = await prisma.service.findUnique({
		where: { id: serviceId },
		select: { id: true }
	});

	if (!service) {
		return json({ error: 'Service not found' }, { status: 404 });
	}

	const body = await request.json();
	const { date, minutes, description, type, category, billable, userId } = body;

	if (!date) {
		return json({ error: 'Date is required' }, { status: 400 });
	}
	if (!minutes || Number(minutes) <= 0) {
		return json({ error: 'Minutes must be greater than 0' }, { status: 400 });
	}

	const timeRecord = await prisma.timeRecord.create({
		data: {
			serviceId,
			date: new Date(date),
			minutes: Math.round(Number(minutes)),
			description: description?.trim() || null,
			type: type || null,
			category: category || null,
			billable: billable !== undefined ? billable : true,
			userId: userId || null,
			createdById: locals.user!.id
		},
		select: timeRecordSelect
	});

	await recalcServiceSpentTime(serviceId);

	await logCreate(locals.user!.id, 'services', String(timeRecord.id), 'TimeRecord', {
		serviceId,
		date,
		minutes: Math.round(Number(minutes)),
		userId: userId || null,
		billable: timeRecord.billable
	});

	return json({ timeRecord }, { status: 201 });
};
