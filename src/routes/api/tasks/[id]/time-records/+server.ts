import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, canAccessProject } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';
import { recalcTaskSpentTime } from '$lib/server/time-records';

const timeRecordSelect = {
	id: true,
	date: true,
	minutes: true,
	description: true,
	type: true,
	category: true,
	billable: true,
	personId: true,
	person: {
		select: { id: true, firstName: true, lastName: true }
	},
	createdById: true,
	createdBy: {
		select: { id: true, name: true }
	},
	createdAt: true
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
	await requirePermission(locals, 'projects', 'update');

	const taskId = parseInt(params.id);
	if (isNaN(taskId)) {
		return json({ error: 'Invalid task ID' }, { status: 400 });
	}

	const task = await prisma.task.findUnique({
		where: { id: taskId },
		select: { id: true, projectId: true }
	});

	if (!task) {
		return json({ error: 'Task not found' }, { status: 404 });
	}

	// Row-level access: verify user can access this task's project
	if (!(await canAccessProject(locals, task.projectId))) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body = await request.json();
	const { date, minutes, description, type, category, billable, personId } = body;

	if (!date) {
		return json({ error: 'Date is required' }, { status: 400 });
	}
	if (!minutes || Number(minutes) <= 0) {
		return json({ error: 'Minutes must be greater than 0' }, { status: 400 });
	}

	const timeRecord = await prisma.timeRecord.create({
		data: {
			taskId,
			date: new Date(date),
			minutes: Math.round(Number(minutes)),
			description: description?.trim() || null,
			type: type || null,
			category: category || null,
			billable: billable !== undefined ? billable : true,
			personId: personId || null,
			createdById: locals.user!.id
		},
		select: timeRecordSelect
	});

	await recalcTaskSpentTime(taskId);

	await logCreate(locals.user!.id, 'projects', String(timeRecord.id), 'TimeRecord', {
		taskId,
		date,
		minutes: Math.round(Number(minutes)),
		personId: personId || null,
		billable: timeRecord.billable
	});

	return json({ timeRecord }, { status: 201 });
};
