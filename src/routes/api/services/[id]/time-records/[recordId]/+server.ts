import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, isAdmin } from '$lib/server/access-control';
import { logUpdate, logDelete } from '$lib/server/audit';
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

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	await requirePermission(locals, 'services', 'update');

	const serviceId = parseInt(params.id);
	const recordId = parseInt(params.recordId);
	if (isNaN(serviceId) || isNaN(recordId)) {
		return json({ error: 'Invalid IDs' }, { status: 400 });
	}

	const existing = await prisma.timeRecord.findUnique({
		where: { id: recordId },
		select: {
			id: true,
			serviceId: true,
			date: true,
			minutes: true,
			description: true,
			type: true,
			category: true,
			billable: true,
			userId: true,
			createdById: true
		}
	});

	if (!existing || existing.serviceId !== serviceId) {
		return json({ error: 'Time record not found' }, { status: 404 });
	}

	// Row-level access: only the creator or an admin can edit
	const userId = locals.user!.id;
	const isCreator = existing.createdById === userId;
	if (!isCreator) {
		const admin = await isAdmin(locals);
		if (!admin) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}
	}

	const body = await request.json();
	const data: Record<string, unknown> = {};
	const oldValues: Record<string, unknown> = {};

	if ('date' in body) {
		if (!body.date) return json({ error: 'Date is required' }, { status: 400 });
		data.date = new Date(body.date);
		oldValues.date = existing.date;
	}
	if ('minutes' in body) {
		if (!body.minutes || Number(body.minutes) <= 0) {
			return json({ error: 'Minutes must be greater than 0' }, { status: 400 });
		}
		data.minutes = Math.round(Number(body.minutes));
		oldValues.minutes = existing.minutes;
	}
	if ('description' in body) {
		data.description = body.description?.trim() || null;
		oldValues.description = existing.description;
	}
	if ('type' in body) {
		data.type = body.type || null;
		oldValues.type = existing.type;
	}
	if ('category' in body) {
		data.category = body.category || null;
		oldValues.category = existing.category;
	}
	if ('billable' in body) {
		data.billable = !!body.billable;
		oldValues.billable = existing.billable;
	}
	if ('userId' in body) {
		data.userId = body.userId || null;
		oldValues.userId = existing.userId;
	}

	const updated = await prisma.timeRecord.update({
		where: { id: recordId },
		data,
		select: timeRecordSelect
	});

	if ('minutes' in data) {
		await recalcServiceSpentTime(serviceId);
	}

	await logUpdate(locals.user!.id, 'services', String(recordId), 'TimeRecord', oldValues, body);

	return json({ timeRecord: updated });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'services', 'update');

	const serviceId = parseInt(params.id);
	const recordId = parseInt(params.recordId);
	if (isNaN(serviceId) || isNaN(recordId)) {
		return json({ error: 'Invalid IDs' }, { status: 400 });
	}

	const existing = await prisma.timeRecord.findUnique({
		where: { id: recordId },
		select: {
			id: true,
			serviceId: true,
			minutes: true,
			date: true,
			createdById: true
		}
	});

	if (!existing || existing.serviceId !== serviceId) {
		return json({ error: 'Time record not found' }, { status: 404 });
	}

	// Row-level access: only the creator or an admin can delete
	const userId = locals.user!.id;
	const isCreator = existing.createdById === userId;
	if (!isCreator) {
		const admin = await isAdmin(locals);
		if (!admin) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}
	}

	await logDelete(locals.user!.id, 'services', String(recordId), 'TimeRecord', {
		minutes: existing.minutes,
		date: existing.date
	});

	await prisma.timeRecord.delete({ where: { id: recordId } });

	await recalcServiceSpentTime(serviceId);

	return json({ success: true });
};
