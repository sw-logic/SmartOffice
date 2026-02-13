import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission } from '$lib/server/access-control';
import { getFile } from '$lib/server/file-upload';

export const GET: RequestHandler = async ({ locals, params }) => {
	await requirePermission(locals, 'tools', 'read');

	const id = parseInt(params.id);
	if (isNaN(id)) throw error(400, 'Invalid audit ID');

	const audit = await prisma.seoAudit.findUnique({
		where: { id },
		select: { pdfPath: true, status: true }
	});

	if (!audit) throw error(404, 'Audit not found');
	if (audit.status !== 'completed' || !audit.pdfPath) {
		throw error(404, 'PDF report not available');
	}

	const pdfBuffer = await getFile(audit.pdfPath);
	if (!pdfBuffer) throw error(404, 'PDF file not found');

	return new Response(new Uint8Array(pdfBuffer), {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="seo-audit-${id}.pdf"`,
			'Content-Length': String(pdfBuffer.length)
		}
	});
};
