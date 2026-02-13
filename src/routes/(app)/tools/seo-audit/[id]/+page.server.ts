import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import { requirePermission, checkPermission } from '$lib/server/access-control';
import { error } from '@sveltejs/kit';
import { parseId } from '$lib/server/crud-helpers';

export const load: PageServerLoad = async ({ locals, params }) => {
	await requirePermission(locals, 'tools', 'read');

	const auditId = parseId(params.id, 'SEO Audit');

	const audit = await prisma.seoAudit.findUnique({
		where: { id: auditId },
		include: {
			createdBy: {
				select: { id: true, name: true, email: true }
			}
		}
	});

	if (!audit) throw error(404, 'Audit not found');

	const canDelete = checkPermission(locals, 'tools', 'delete');

	return {
		audit: {
			id: audit.id,
			status: audit.status,
			urls: audit.urls as string[],
			progress: audit.progress as {
				currentUrl: string;
				currentStep: string;
				completedUrls: number;
				totalUrls: number;
			} | null,
			results: (audit.results ?? []) as Array<{
				url: string;
				status: string;
				error?: string;
				crawl: {
					url: string;
					statusCode: number;
					loadTimeMs: number;
					title: string;
					metaDescription: string;
					canonicalUrl: string;
					ogTags: Record<string, string>;
					headings: { level: number; text: string }[];
					images: { src: string; alt: string; hasAlt: boolean }[];
					links: { href: string; text: string; isExternal: boolean }[];
					wordCount: number;
					hasViewportMeta: boolean;
					structuredData: unknown[];
					desktopScreenshotPath: string | null;
					mobileScreenshotPath: string | null;
				} | null;
				issues: Array<{
					severity: 'critical' | 'warning' | 'info';
					category: string;
					title: string;
					description: string;
					recommendation: string;
				}>;
				lighthouseScores: {
					performance: number | null;
					accessibility: number | null;
					bestPractices: number | null;
					seo: number | null;
				} | null;
				coreWebVitals: {
					lcp: number | null;
					fid: number | null;
					cls: number | null;
					fcp: number | null;
					ttfb: number | null;
				} | null;
				aiAnalysis: {
					contentQuality: number;
					readability: number;
					keywordRelevance: number;
					recommendations: string[];
					summary: string;
				} | null;
				hasSitemap: boolean | null;
				hasRobotsTxt: boolean | null;
			}>,
			summary: audit.summary as {
				overallScore: number;
				categoryScores: {
					technical: number;
					content: number;
					performance: number;
					accessibility: number;
				};
				topIssues: Array<{
					severity: 'critical' | 'warning' | 'info';
					category: string;
					title: string;
					description: string;
					recommendation: string;
				}>;
				executiveSummary: string;
				totalIssues: { critical: number; warning: number; info: number };
			} | null,
			language: audit.language,
			pdfPath: audit.pdfPath,
			error: audit.error,
			createdBy: audit.createdBy,
			startedAt: audit.startedAt?.toISOString() ?? null,
			completedAt: audit.completedAt?.toISOString() ?? null,
			createdAt: audit.createdAt.toISOString()
		},
		canDelete
	};
};
