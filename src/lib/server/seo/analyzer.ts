import type { CrawlResult, SeoIssue } from './types';

const FETCH_TIMEOUT = 5000;

/**
 * Analyze crawl results and produce SEO issues.
 */
export function analyzeCrawlResult(crawl: CrawlResult): SeoIssue[] {
	const issues: SeoIssue[] = [];

	// === Title tag ===
	if (!crawl.title) {
		issues.push({
			severity: 'critical',
			category: 'meta',
			title: 'Missing title tag',
			description: 'The page has no <title> tag.',
			recommendation: 'Add a descriptive title tag between 30-60 characters.'
		});
	} else if (crawl.title.length < 30) {
		issues.push({
			severity: 'warning',
			category: 'meta',
			title: 'Title tag too short',
			description: `Title is only ${crawl.title.length} characters: "${crawl.title}"`,
			recommendation: 'Aim for 30-60 characters for optimal SEO.'
		});
	} else if (crawl.title.length > 60) {
		issues.push({
			severity: 'warning',
			category: 'meta',
			title: 'Title tag too long',
			description: `Title is ${crawl.title.length} characters and may be truncated in search results.`,
			recommendation: 'Keep title under 60 characters.'
		});
	}

	// === Meta description ===
	if (!crawl.metaDescription) {
		issues.push({
			severity: 'critical',
			category: 'meta',
			title: 'Missing meta description',
			description: 'No meta description tag found.',
			recommendation: 'Add a meta description between 120-160 characters.'
		});
	} else if (crawl.metaDescription.length < 120) {
		issues.push({
			severity: 'warning',
			category: 'meta',
			title: 'Meta description too short',
			description: `Meta description is only ${crawl.metaDescription.length} characters.`,
			recommendation: 'Aim for 120-160 characters for optimal display.'
		});
	} else if (crawl.metaDescription.length > 160) {
		issues.push({
			severity: 'warning',
			category: 'meta',
			title: 'Meta description too long',
			description: `Meta description is ${crawl.metaDescription.length} characters and may be truncated.`,
			recommendation: 'Keep meta description under 160 characters.'
		});
	}

	// === H1 headings ===
	const h1s = crawl.headings.filter(h => h.level === 1);
	if (h1s.length === 0) {
		issues.push({
			severity: 'critical',
			category: 'content',
			title: 'Missing H1 heading',
			description: 'No H1 heading found on the page.',
			recommendation: 'Add exactly one H1 heading that describes the main topic.'
		});
	} else if (h1s.length > 1) {
		issues.push({
			severity: 'warning',
			category: 'content',
			title: 'Multiple H1 headings',
			description: `Found ${h1s.length} H1 headings. Best practice is to have exactly one.`,
			recommendation: 'Use only one H1 per page. Use H2-H6 for sub-sections.'
		});
	}

	// === Heading hierarchy ===
	let prevLevel = 0;
	for (const heading of crawl.headings) {
		if (heading.level > prevLevel + 1 && prevLevel > 0) {
			issues.push({
				severity: 'info',
				category: 'content',
				title: 'Heading hierarchy skip',
				description: `Heading jumps from H${prevLevel} to H${heading.level}: "${heading.text.substring(0, 50)}"`,
				recommendation: 'Use heading levels in sequential order (H1 → H2 → H3, etc.).'
			});
			break; // Only report first occurrence
		}
		prevLevel = heading.level;
	}

	// === Images without alt ===
	const imagesWithoutAlt = crawl.images.filter(img => !img.hasAlt);
	if (imagesWithoutAlt.length > 0) {
		issues.push({
			severity: 'warning',
			category: 'accessibility',
			title: `${imagesWithoutAlt.length} image(s) missing alt text`,
			description: `Found ${imagesWithoutAlt.length} of ${crawl.images.length} images without alt attributes.`,
			recommendation: 'Add descriptive alt text to all images for accessibility and SEO.'
		});
	}

	// === Viewport meta ===
	if (!crawl.hasViewportMeta) {
		issues.push({
			severity: 'critical',
			category: 'mobile',
			title: 'Missing viewport meta tag',
			description: 'No viewport meta tag found. Mobile rendering will be affected.',
			recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.'
		});
	}

	// === Canonical URL ===
	if (!crawl.canonicalUrl) {
		issues.push({
			severity: 'warning',
			category: 'technical',
			title: 'Missing canonical URL',
			description: 'No canonical link element found.',
			recommendation: 'Add <link rel="canonical"> to prevent duplicate content issues.'
		});
	}

	// === Open Graph tags ===
	const requiredOgTags = ['og:title', 'og:description', 'og:image'];
	const missingOg = requiredOgTags.filter(tag => !crawl.ogTags[tag]);
	if (missingOg.length > 0) {
		issues.push({
			severity: 'info',
			category: 'meta',
			title: 'Missing Open Graph tags',
			description: `Missing: ${missingOg.join(', ')}`,
			recommendation: 'Add Open Graph tags for better social media sharing.'
		});
	}

	// === Word count ===
	if (crawl.wordCount < 300) {
		issues.push({
			severity: 'warning',
			category: 'content',
			title: 'Thin content',
			description: `Page has only ${crawl.wordCount} words.`,
			recommendation: 'Aim for at least 300 words of quality content for better rankings.'
		});
	}

	// === Status code ===
	if (crawl.statusCode >= 400) {
		issues.push({
			severity: 'critical',
			category: 'technical',
			title: `HTTP ${crawl.statusCode} error`,
			description: `Page returned status code ${crawl.statusCode}.`,
			recommendation: 'Fix the HTTP error to ensure the page is accessible.'
		});
	} else if (crawl.statusCode >= 300 && crawl.statusCode < 400) {
		issues.push({
			severity: 'info',
			category: 'technical',
			title: `HTTP ${crawl.statusCode} redirect`,
			description: `Page returned redirect status ${crawl.statusCode}.`,
			recommendation: 'Ensure redirects are intentional and update links to point to the final URL.'
		});
	}

	// === Load time ===
	if (crawl.loadTimeMs > 5000) {
		issues.push({
			severity: 'warning',
			category: 'performance',
			title: 'Slow page load',
			description: `Page took ${(crawl.loadTimeMs / 1000).toFixed(1)}s to load.`,
			recommendation: 'Optimize images, minimize JavaScript, and consider CDN usage.'
		});
	}

	// === Structured data ===
	if (crawl.structuredData.length === 0) {
		issues.push({
			severity: 'info',
			category: 'technical',
			title: 'No structured data',
			description: 'No JSON-LD structured data found.',
			recommendation: 'Add Schema.org structured data for rich search results.'
		});
	}

	// === Internal vs external links ===
	const externalLinks = crawl.links.filter(l => l.isExternal);
	const internalLinks = crawl.links.filter(l => !l.isExternal);
	if (internalLinks.length === 0 && crawl.links.length > 0) {
		issues.push({
			severity: 'warning',
			category: 'content',
			title: 'No internal links',
			description: 'Page has no internal links. Internal linking helps SEO.',
			recommendation: 'Add links to other relevant pages on your site.'
		});
	}

	// === Robots meta noindex ===
	if (crawl.hasRobotsMeta && crawl.hasRobotsMeta.toLowerCase().includes('noindex')) {
		issues.push({
			severity: 'critical',
			category: 'technical',
			title: 'Page is set to noindex',
			description: 'Robots meta tag contains "noindex" — search engines will not index this page.',
			recommendation: 'Remove noindex if this page should appear in search results.'
		});
	}

	return issues;
}

/**
 * Check if sitemap.xml exists at the root of the domain.
 */
export async function checkSitemap(url: string): Promise<boolean> {
	try {
		const parsed = new URL(url);
		const sitemapUrl = `${parsed.origin}/sitemap.xml`;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
		const response = await fetch(sitemapUrl, {
			method: 'HEAD',
			signal: controller.signal,
			redirect: 'follow'
		});
		clearTimeout(timeout);
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Check if robots.txt exists at the root of the domain.
 */
export async function checkRobotsTxt(url: string): Promise<boolean> {
	try {
		const parsed = new URL(url);
		const robotsUrl = `${parsed.origin}/robots.txt`;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
		const response = await fetch(robotsUrl, {
			method: 'HEAD',
			signal: controller.signal,
			redirect: 'follow'
		});
		clearTimeout(timeout);
		return response.ok;
	} catch {
		return false;
	}
}
