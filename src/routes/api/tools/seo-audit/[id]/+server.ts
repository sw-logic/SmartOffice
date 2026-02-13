import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { logDelete } from '$lib/server/audit';
import { deleteDirectory } from '$lib/server/file-upload';

export const GET: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'tools', 'read');

	const id = parseInt(params.id);
	if (isNaN(id)) throw error(400, 'Invalid audit ID');

	const audit = await prisma.seoAudit.findUnique({
		where: { id }
	});

	if (!audit) throw error(404, 'Audit not found');

	return json({
		id: audit.id,
		status: audit.status,
		urls: audit.urls,
		progress: audit.progress,
		results: audit.results,
		summary: audit.summary,
		pdfPath: audit.pdfPath,
		error: audit.error,
		startedAt: audit.startedAt,
		completedAt: audit.completedAt,
		createdAt: audit.createdAt
	});
};

export const DELETE: RequestHandler = async (event) => {
	const { locals, params } = event;
	await requirePermission(locals, 'tools', 'delete');

	const id = parseInt(params.id);
	if (isNaN(id)) throw error(400, 'Invalid audit ID');

	const audit = await prisma.seoAudit.findUnique({
		where: { id }
	});

	if (!audit) throw error(404, 'Audit not found');

	if (audit.status === 'running') {
		throw error(409, 'Cannot delete a running audit. Please wait for it to finish.');
	}

	// Audit log BEFORE delete
	await logDelete(
		locals.user!.id,
		'tools',
		String(audit.id),
		'SeoAudit',
		{
			urls: audit.urls,
			status: audit.status,
			createdAt: audit.createdAt
		},
		event
	);

	// Delete the database record
	await prisma.seoAudit.delete({ where: { id } });

	// Cleanup files
	await deleteDirectory(`seo-audits/${id}`);

	return json({ success: true });
};
