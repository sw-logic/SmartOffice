import Anthropic from '@anthropic-ai/sdk';
import type { CrawlResult, AiContentAnalysis, SeoUrlResult, SeoIssue } from './types';

const AI_TIMEOUT = 30000;
const MAX_BODY_WORDS = 3000;

const LANGUAGE_NAMES: Record<string, string> = {
	en: 'English',
	hu: 'Hungarian',
	de: 'German',
	fr: 'French',
	es: 'Spanish',
	it: 'Italian',
	pt: 'Portuguese',
	nl: 'Dutch',
	pl: 'Polish',
	cs: 'Czech',
	sk: 'Slovak',
	ro: 'Romanian',
	hr: 'Croatian',
	sr: 'Serbian',
	bg: 'Bulgarian',
	ru: 'Russian',
	uk: 'Ukrainian',
	ja: 'Japanese',
	zh: 'Chinese',
	ko: 'Korean'
};

function getLanguageName(code: string): string {
	return LANGUAGE_NAMES[code] || code;
}

function getClient(): Anthropic | null {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) return null;
	return new Anthropic({ apiKey });
}

/**
 * Truncate body text to a reasonable size for cost control.
 */
function truncateBodyText(html: string): string {
	// Strip tags to get text content
	const text = html
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	const words = text.split(' ');
	if (words.length > MAX_BODY_WORDS) {
		return words.slice(0, MAX_BODY_WORDS).join(' ') + '...';
	}
	return text;
}

/**
 * Analyze page content using Claude API.
 * Returns null if AI analysis fails (non-blocking).
 */
export async function analyzePageContent(crawl: CrawlResult, language: string): Promise<AiContentAnalysis | null> {
	const client = getClient();
	if (!client) return null;

	const bodyText = truncateBodyText(crawl.html);
	const headingsText = crawl.headings.map(h => `${'#'.repeat(h.level)} ${h.text}`).join('\n');
	const langName = getLanguageName(language);

	const prompt = `Analyze this web page for SEO content quality. Write your "summary" and "recommendations" in ${langName}. Respond ONLY with valid JSON matching this schema:
{
  "contentQuality": <1-10>,
  "readability": <1-10>,
  "keywordRelevance": <1-10>,
  "recommendations": ["<recommendation in ${langName}>", ...],
  "summary": "<2-3 sentence summary in ${langName}>"
}

Page URL: ${crawl.url}
Title: ${crawl.title}
Meta Description: ${crawl.metaDescription}
Word Count: ${crawl.wordCount}

Headings:
${headingsText}

Body Text (truncated):
${bodyText.substring(0, 8000)}`;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

		const response = await client.messages.create({
			model: 'claude-sonnet-4-5-20250929',
			max_tokens: 1024,
			messages: [{ role: 'user', content: prompt }]
		});

		clearTimeout(timeout);

		const text = response.content
			.filter(block => block.type === 'text')
			.map(block => block.text)
			.join('');

		// Extract JSON from response (handle markdown code blocks)
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) return null;

		const parsed = JSON.parse(jsonMatch[0]) as AiContentAnalysis;
		return {
			contentQuality: Math.min(10, Math.max(1, parsed.contentQuality)),
			readability: Math.min(10, Math.max(1, parsed.readability)),
			keywordRelevance: Math.min(10, Math.max(1, parsed.keywordRelevance)),
			recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 10) : [],
			summary: typeof parsed.summary === 'string' ? parsed.summary : ''
		};
	} catch (error) {
		console.error('AI page analysis failed:', error instanceof Error ? error.message : error);
		return null;
	}
}

/**
 * Generate executive summary for the entire audit using Claude API.
 * Returns a markdown string or fallback text.
 */
export async function generateExecutiveSummary(
	results: SeoUrlResult[],
	allIssues: SeoIssue[],
	language: string
): Promise<string> {
	const client = getClient();
	if (!client) {
		return generateFallbackSummary(results, allIssues);
	}

	const langName = getLanguageName(language);

	const issueBreakdown = {
		critical: allIssues.filter(i => i.severity === 'critical').length,
		warning: allIssues.filter(i => i.severity === 'warning').length,
		info: allIssues.filter(i => i.severity === 'info').length
	};

	const urlSummaries = results.map(r => {
		const scores = r.lighthouseScores;
		return `- ${r.url}: ${r.issues.length} issues, ${r.status === 'error' ? 'FAILED' : 'OK'}${
			scores ? `, Performance: ${scores.performance ?? 'N/A'}, SEO: ${scores.seo ?? 'N/A'}` : ''
		}`;
	}).join('\n');

	const topIssues = allIssues
		.filter(i => i.severity === 'critical')
		.slice(0, 5)
		.map(i => `- [${i.category}] ${i.title}: ${i.description}`)
		.join('\n');

	const prompt = `Write a concise executive summary (in markdown) for an SEO audit of ${results.length} URLs.

IMPORTANT: Write the entire summary in ${langName}.

Issue breakdown: ${issueBreakdown.critical} critical, ${issueBreakdown.warning} warnings, ${issueBreakdown.info} informational

URL summaries:
${urlSummaries}

Top critical issues:
${topIssues}

Write 2-3 paragraphs in ${langName} covering:
1. Overall SEO health assessment
2. Key areas that need immediate attention
3. Recommended next steps

Keep it under 300 words. Use markdown formatting.`;

	try {
		const response = await client.messages.create({
			model: 'claude-sonnet-4-5-20250929',
			max_tokens: 2048,
			messages: [{ role: 'user', content: prompt }]
		});

		return response.content
			.filter(block => block.type === 'text')
			.map(block => block.text)
			.join('');
	} catch (error) {
		console.error('AI executive summary failed:', error instanceof Error ? error.message : error);
		return generateFallbackSummary(results, allIssues);
	}
}

/**
 * Batch-translate all issues into the target language via a single Claude API call.
 * Mutates issues in place. Skips if language is 'en' or no API key.
 */
export async function translateIssues(issues: SeoIssue[], language: string): Promise<void> {
	if (language === 'en' || issues.length === 0) return;

	const client = getClient();
	if (!client) return;

	const langName = getLanguageName(language);

	// Deduplicate by title to minimize tokens
	const uniqueMap = new Map<string, { title: string; description: string; recommendation: string }>();
	for (const issue of issues) {
		if (!uniqueMap.has(issue.title)) {
			uniqueMap.set(issue.title, {
				title: issue.title,
				description: issue.description,
				recommendation: issue.recommendation
			});
		}
	}

	const entries = [...uniqueMap.values()];

	const prompt = `Translate these SEO audit findings into ${langName}. Keep technical terms (HTML, meta, sitemap, robots.txt, h1, alt, etc.) untranslated. Respond ONLY with a valid JSON array matching the input structure.

Input:
${JSON.stringify(entries, null, 2)}

Return the same array with title, description, and recommendation translated to ${langName}. Keep the exact same order and count.`;

	try {
		const response = await client.messages.create({
			model: 'claude-sonnet-4-5-20250929',
			max_tokens: 4096,
			messages: [{ role: 'user', content: prompt }]
		});

		const text = response.content
			.filter(block => block.type === 'text')
			.map(block => block.text)
			.join('');

		const jsonMatch = text.match(/\[[\s\S]*\]/);
		if (!jsonMatch) return;

		const translated = JSON.parse(jsonMatch[0]) as Array<{ title: string; description: string; recommendation: string }>;
		if (!Array.isArray(translated) || translated.length !== entries.length) return;

		// Build lookup: original title → translated fields
		const translationMap = new Map<string, { title: string; description: string; recommendation: string }>();
		for (let i = 0; i < entries.length; i++) {
			translationMap.set(entries[i].title, translated[i]);
		}

		// Apply translations to all issues (including duplicates)
		for (const issue of issues) {
			const t = translationMap.get(issue.title);
			if (t) {
				issue.title = t.title;
				issue.description = t.description;
				issue.recommendation = t.recommendation;
			}
		}
	} catch (error) {
		console.error('Issue translation failed:', error instanceof Error ? error.message : error);
		// non-blocking — issues remain in English
	}
}

function generateFallbackSummary(results: SeoUrlResult[], allIssues: SeoIssue[]): string {
	const critical = allIssues.filter(i => i.severity === 'critical').length;
	const warning = allIssues.filter(i => i.severity === 'warning').length;
	const successful = results.filter(r => r.status === 'success').length;

	return `## SEO Audit Summary

Audited **${results.length}** URLs — **${successful}** successfully analyzed.

Found **${allIssues.length}** total issues: **${critical}** critical, **${warning}** warnings.

${critical > 0 ? '**Immediate action required** — critical issues found that may impact search engine visibility.' : 'No critical issues found.'}`;
}
