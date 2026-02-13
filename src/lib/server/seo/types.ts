// SEO Audit Engine — Type definitions

export interface SeoAuditProgress {
	currentUrl: string;
	currentStep: string;
	completedUrls: number;
	totalUrls: number;
}

export interface SeoIssue {
	severity: 'critical' | 'warning' | 'info';
	category: 'meta' | 'content' | 'performance' | 'accessibility' | 'technical' | 'mobile';
	title: string;
	description: string;
	recommendation: string;
}

export interface LighthouseScores {
	performance: number | null;
	accessibility: number | null;
	bestPractices: number | null;
	seo: number | null;
}

export interface CoreWebVitals {
	lcp: number | null; // Largest Contentful Paint (ms)
	fid: number | null; // First Input Delay (ms)
	cls: number | null; // Cumulative Layout Shift
	fcp: number | null; // First Contentful Paint (ms)
	ttfb: number | null; // Time to First Byte (ms)
}

export interface AiContentAnalysis {
	contentQuality: number; // 1-10
	readability: number; // 1-10
	keywordRelevance: number; // 1-10
	recommendations: string[];
	summary: string;
}

export interface CrawlResult {
	url: string;
	statusCode: number;
	loadTimeMs: number;
	html: string;
	title: string;
	metaDescription: string;
	metaKeywords: string;
	canonicalUrl: string;
	ogTags: Record<string, string>;
	headings: { level: number; text: string }[];
	images: { src: string; alt: string; hasAlt: boolean }[];
	links: { href: string; text: string; isExternal: boolean }[];
	wordCount: number;
	hasRobotsMeta: string;
	hasViewportMeta: boolean;
	structuredData: unknown[];
	desktopScreenshotPath: string | null;
	mobileScreenshotPath: string | null;
}

export interface SeoUrlResult {
	url: string;
	status: 'success' | 'error';
	error?: string;
	crawl: CrawlResult | null;
	crawlerError?: string;
	issues: SeoIssue[];
	lighthouseScores: LighthouseScores | null;
	coreWebVitals: CoreWebVitals | null;
	lighthouseError?: string;
	aiAnalysis: AiContentAnalysis | null;
	aiError?: string;
	hasSitemap: boolean | null;
	hasRobotsTxt: boolean | null;
}

export interface SeoAuditSummary {
	overallScore: number; // 0-100
	categoryScores: {
		technical: number;
		content: number;
		performance: number;
		accessibility: number;
	};
	topIssues: SeoIssue[];
	executiveSummary: string; // AI-generated markdown
	totalIssues: { critical: number; warning: number; info: number };
}
