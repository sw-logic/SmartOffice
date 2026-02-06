import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logCreate } from '$lib/server/audit';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	await requirePermission(locals, 'projects', 'update');

	const taskId = parseInt(params.id);
	if (isNaN(taskId)) {
		return json({ error: 'Invalid task ID' }, { status: 400 });
	}

	const task = await prisma.task.findUnique({
		where: { id: taskId },
		select: { id: true }
	});

	if (!task) {
		return json({ error: 'Task not found' }, { status: 404 });
	}

	const body = await request.json();
	const { date, hours, description, type, category } = body;

	if (!date) {
		return json({ error: 'Date is required' }, { status: 400 });
	}
	if (!hours || Number(hours) <= 0) {
		return json({ error: 'Hours must be greater than 0' }, { status: 400 });
	}

	const timeRecord = await prisma.timeRecord.create({
		data: {
			taskId,
			date: new Date(date),
			hours: Number(hours),
			description: description?.trim() || null,
			type: type || null,
			category: category || null,
			createdById: locals.user!.id
		},
		select: {
			id: true,
			date: true,
			hours: true,
			description: true,
			type: true,
			category: true,
			createdById: true,
			createdBy: {
				select: { id: true, name: true }
			},
			createdAt: true
		}
	});

	await logCreate(locals.user!.id, 'projects', String(timeRecord.id), 'TimeRecord', {
		taskId,
		date,
		hours: Number(hours)
	});

	return json({ timeRecord }, { status: 201 });
};
