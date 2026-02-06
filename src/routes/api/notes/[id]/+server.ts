import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logUpdate, logDelete } from '$lib/server/audit';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	await requirePermission(locals, 'projects', 'update');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid note ID' }, { status: 400 });
	}

	const existing = await prisma.note.findUnique({
		where: { id },
		select: { id: true, content: true, priority: true, color: true, deletedAt: true }
	});

	if (!existing || existing.deletedAt) {
		return json({ error: 'Note not found' }, { status: 404 });
	}

	const body = await request.json();
	const data: Record<string, unknown> = {};
	const oldValues: Record<string, unknown> = {};

	if ('content' in body) {
		if (!body.content?.trim()) {
			return json({ error: 'Note content is required' }, { status: 400 });
		}
		data.content = body.content.trim();
		oldValues.content = existing.content;
	}

	if ('priority' in body) {
		data.priority = body.priority;
		oldValues.priority = existing.priority;
	}

	if ('color' in body) {
		data.color = body.color || null;
		oldValues.color = existing.color;
	}

	const updated = await prisma.note.update({
		where: { id },
		data,
		select: {
			id: true,
			content: true,
			priority: true,
			color: true,
			createdAt: true,
			author: {
				select: { id: true, name: true }
			}
		}
	});

	await logUpdate(locals.user!.id, 'projects', String(id), 'Note', oldValues, body);

	return json({ note: updated });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'projects', 'update');

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid note ID' }, { status: 400 });
	}

	const note = await prisma.note.findUnique({
		where: { id },
		select: { id: true, content: true, deletedAt: true }
	});

	if (!note || note.deletedAt) {
		return json({ error: 'Note not found' }, { status: 404 });
	}

	await prisma.note.update({
		where: { id },
		data: { deletedAt: new Date() }
	});

	await logDelete(locals.user!.id, 'projects', String(id), 'Note', {
		content: note.content
	});

	return json({ success: true });
};
