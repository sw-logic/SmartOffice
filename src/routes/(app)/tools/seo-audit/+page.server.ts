import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';

export const load: PageServerLoad = async ({ locals }) => {
	await requirePermission(locals, 'tools', 'read');

	const userId = locals.user!.id;

	// Load user's recent audits
	const audits = await prisma.seoAudit.findMany({
		where: { createdById: userId },
		orderBy: { createdAt: 'desc' },
		take: 20,
		select: {
			id: true,
			status: true,
			language: true,
			urls: true,
			progress: true,
			summary: true,
			pdfPath: true,
			error: true,
			startedAt: true,
			completedAt: true,
			createdAt: true
		}
	});

	const canCreate = checkPermission(locals, 'tools', 'create');
	const canDelete = checkPermission(locals, 'tools', 'delete');

	// Check if there's a running audit to auto-resume polling
	const runningAudit = audits.find(a => a.status === 'running' || a.status === 'pending');

	return {
		audits: audits.map(a => ({
			...a,
			urls: a.urls as string[],
			progress: a.progress as { currentUrl: string; currentStep: string; completedUrls: number; totalUrls: number } | null,
			summary: a.summary as { overallScore: number; totalIssues: { critical: number; warning: number; info: number } } | null,
			startedAt: a.startedAt?.toISOString() ?? null,
			completedAt: a.completedAt?.toISOString() ?? null,
			createdAt: a.createdAt.toISOString()
		})),
		canCreate,
		canDelete,
		runningAuditId: runningAudit?.id ?? null
	};
};
