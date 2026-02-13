import { prisma } from '../prisma';
import { crawlUrl, closeBrowser } from './crawler';
import { analyzeCrawlResult, checkSitemap, checkRobotsTxt } from './analyzer';
import { runLighthouse } from './lighthouse-runner';
import { analyzePageContent, generateExecutiveSummary, translateIssues } from './ai-analyzer';
import { generateScoresRadarChart, generateIssuesBreakdownChart, generateCategoryScoresBarChart } from './chart-generator';
import { generatePdfReport } from './pdf-generator';
import type { SeoAuditProgress, SeoUrlResult, SeoAuditSummary, SeoIssue } from './types';

const PER_URL_TIMEOUT = parseInt(process.env.SEO_AUDIT_TIMEOUT || '120000');

async function updateProgress(auditId: number, progress: SeoAuditProgress): Promise<void> {
	try {
		await prisma.seoAudit.update({
			where: { id: auditId },
			data: { progress: progress as object }
		});
	} catch {
		// non-blocking
	}
}

async function auditSingleUrl(
	url: string,
	auditId: number,
	urlIndex: number,
	totalUrls: number,
	language: string
): Promise<SeoUrlResult> {
	const result: SeoUrlResult = {
		url,
		status: 'success',
		crawl: null,
		issues: [],
		lighthouseScores: null,
		coreWebVitals: null,
		aiAnalysis: null,
		hasSitemap: null,
		hasRobotsTxt: null
	};

	try {
		// Step 1: Crawl
		await updateProgress(auditId, {
			currentUrl: url,
			currentStep: 'Crawling page...',
			completedUrls: urlIndex,
			totalUrls
		});

		result.crawl = await Promise.race([
			crawlUrl(url, auditId, urlIndex),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Crawl timeout')), PER_URL_TIMEOUT)
			)
		]);

		// Step 2: Analyze HTML
		await updateProgress(auditId, {
			currentUrl: url,
			currentStep: 'Analyzing SEO...',
			completedUrls: urlIndex,
			totalUrls
		});

		result.issues = analyzeCrawlResult(result.crawl);

		// Check sitemap + robots.txt (only for first URL of each domain)
		const [hasSitemap, hasRobotsTxt] = await Promise.all([
			checkSitemap(url),
			checkRobotsTxt(url)
		]);
		result.hasSitemap = hasSitemap;
		result.hasRobotsTxt = hasRobotsTxt;

		if (!hasSitemap) {
			result.issues.push({
				severity: 'warning',
				category: 'technical',
				title: 'No sitemap.xml found',
				description: 'No accessible sitemap.xml at the domain root.',
				recommendation: 'Create a sitemap.xml and submit it to search engines.'
			});
		}
		if (!hasRobotsTxt) {
			result.issues.push({
				severity: 'info',
				category: 'technical',
				title: 'No robots.txt found',
				description: 'No robots.txt file at the domain root.',
				recommendation: 'Create a robots.txt to guide search engine crawlers.'
			});
		}

		// Step 3: Lighthouse (non-blocking)
		await updateProgress(auditId, {
			currentUrl: url,
			currentStep: 'Running Lighthouse...',
			completedUrls: urlIndex,
			totalUrls
		});

		const lhResult = await runLighthouse(url);
		if (lhResult) {
			result.lighthouseScores = lhResult.scores;
			result.coreWebVitals = lhResult.coreWebVitals;
		}

		// Step 4: AI Content Analysis (non-blocking)
		await updateProgress(auditId, {
			currentUrl: url,
			currentStep: 'AI content analysis...',
			completedUrls: urlIndex,
			totalUrls
		});

		result.aiAnalysis = await analyzePageContent(result.crawl, language);

	} catch (error) {
		result.status = 'error';
		result.error = error instanceof Error ? error.message : 'Unknown error';
	}

	return result;
}

function calculateCategoryScores(allIssues: SeoIssue[], results: SeoUrlResult[]): {
	technical: number;
	content: number;
	performance: number;
	accessibility: number;
} {
	// Start at 100 and deduct for issues
	const deductions: Record<string, number> = { critical: 15, warning: 5, info: 1 };
	const categoryMap: Record<string, keyof ReturnType<typeof calculateCategoryScores>> = {
		'meta': 'technical',
		'technical': 'technical',
		'content': 'content',
		'performance': 'performance',
		'accessibility': 'accessibility',
		'mobile': 'technical'
	};

	const scores = { technical: 100, content: 100, performance: 100, accessibility: 100 };

	for (const issue of allIssues) {
		const cat = categoryMap[issue.category] || 'technical';
		scores[cat] = Math.max(0, scores[cat] - (deductions[issue.severity] || 0));
	}

	// Factor in Lighthouse scores if available
	const lhScores = results
		.filter(r => r.lighthouseScores)
		.map(r => r.lighthouseScores!);

	if (lhScores.length > 0) {
		const avg = (vals: (number | null)[]) => {
			const valid = vals.filter(v => v != null) as number[];
			return valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
		};

		const avgPerf = avg(lhScores.map(s => s.performance));
		const avgAccess = avg(lhScores.map(s => s.accessibility));
		const avgSeo = avg(lhScores.map(s => s.seo));

		// Blend: 50% issue-based + 50% lighthouse
		if (avgPerf != null) scores.performance = Math.round((scores.performance + avgPerf) / 2);
		if (avgAccess != null) scores.accessibility = Math.round((scores.accessibility + avgAccess) / 2);
		if (avgSeo != null) scores.technical = Math.round((scores.technical + avgSeo) / 2);
	}

	return scores;
}

/**
 * Run the full SEO audit pipeline. Fire-and-forget from the API endpoint.
 */
export async function runSeoAudit(auditId: number, userId: number): Promise<void> {
	try {
		// Mark as running
		await prisma.seoAudit.update({
			where: { id: auditId },
			data: { status: 'running', startedAt: new Date() }
		});

		const audit = await prisma.seoAudit.findUnique({ where: { id: auditId } });
		if (!audit) throw new Error('Audit not found');

		const urls = audit.urls as string[];
		const language = audit.language;
		const results: SeoUrlResult[] = [];

		// Process each URL sequentially
		for (let i = 0; i < urls.length; i++) {
			const result = await auditSingleUrl(urls[i], auditId, i, urls.length, language);
			results.push(result);

			// Save intermediate results
			await prisma.seoAudit.update({
				where: { id: auditId },
				data: { results: results as unknown as object }
			});
		}

		// Generate summary
		await updateProgress(auditId, {
			currentUrl: '',
			currentStep: 'Generating report...',
			completedUrls: urls.length,
			totalUrls: urls.length
		});

		const allIssues = results.flatMap(r => r.issues);

		// Translate issues if not English (single batch API call)
		if (language !== 'en') {
			await updateProgress(auditId, {
				currentUrl: '',
				currentStep: 'Translating findings...',
				completedUrls: urls.length,
				totalUrls: urls.length
			});
			await translateIssues(allIssues, language);
		}

		const categoryScores = calculateCategoryScores(allIssues, results);
		const overallScore = Math.round(
			(categoryScores.technical + categoryScores.content +
			 categoryScores.performance + categoryScores.accessibility) / 4
		);

		// Top issues (unique by title, sorted by severity)
		const severityOrder = { critical: 0, warning: 1, info: 2 };
		const uniqueIssues = new Map<string, SeoIssue>();
		for (const issue of allIssues) {
			if (!uniqueIssues.has(issue.title)) {
				uniqueIssues.set(issue.title, issue);
			}
		}
		const topIssues = [...uniqueIssues.values()]
			.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
			.slice(0, 10);

		// AI executive summary
		const executiveSummary = await generateExecutiveSummary(results, allIssues, language);

		const summary: SeoAuditSummary = {
			overallScore,
			categoryScores,
			topIssues,
			executiveSummary,
			totalIssues: {
				critical: allIssues.filter(i => i.severity === 'critical').length,
				warning: allIssues.filter(i => i.severity === 'warning').length,
				info: allIssues.filter(i => i.severity === 'info').length
			}
		};

		// Generate charts
		const radarCharts = new Map<number, Buffer>();
		for (let i = 0; i < results.length; i++) {
			if (results[i].lighthouseScores) {
				try {
					const chart = await generateScoresRadarChart(results[i].lighthouseScores!);
					radarCharts.set(i, chart);
				} catch {
					// chart generation failed
				}
			}
		}

		let issuesChart: Buffer | null = null;
		try {
			issuesChart = await generateIssuesBreakdownChart(allIssues);
		} catch {
			// non-blocking
		}

		let categoryChart: Buffer | null = null;
		try {
			categoryChart = await generateCategoryScoresBarChart(categoryScores);
		} catch {
			// non-blocking
		}

		// Generate PDF
		let pdfPath: string | null = null;
		try {
			pdfPath = await generatePdfReport(
				auditId,
				urls,
				results,
				summary,
				{ radarCharts, issuesChart, categoryChart }
			);
		} catch (error) {
			console.error('PDF generation failed:', error);
		}

		// Mark as completed
		await prisma.seoAudit.update({
			where: { id: auditId },
			data: {
				status: 'completed',
				results: results as unknown as object,
				summary: summary as unknown as object,
				pdfPath,
				completedAt: new Date(),
				progress: {
					currentUrl: '',
					currentStep: 'Complete',
					completedUrls: urls.length,
					totalUrls: urls.length
				} as object
			}
		});

	} catch (error) {
		console.error(`SEO Audit ${auditId} failed:`, error);
		await prisma.seoAudit.update({
			where: { id: auditId },
			data: {
				status: 'failed',
				error: error instanceof Error ? error.message : 'Unknown error',
				completedAt: new Date()
			}
		}).catch(() => {});
	} finally {
		await closeBrowser().catch(() => {});
	}
}

/**
 * Mark stale audits (stuck in "running" for >10min) as failed.
 * Call on server startup.
 */
export async function cleanupStaleAudits(): Promise<void> {
	const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
	try {
		await prisma.seoAudit.updateMany({
			where: {
				status: 'running',
				startedAt: { lt: tenMinutesAgo }
			},
			data: {
				status: 'failed',
				error: 'Audit timed out (stale cleanup)',
				completedAt: new Date()
			}
		});
	} catch {
		// non-blocking
	}
}
