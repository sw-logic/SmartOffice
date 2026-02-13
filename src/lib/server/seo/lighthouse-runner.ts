import type { LighthouseScores, CoreWebVitals } from './types';

const LH_TIMEOUT = 90000;

export interface LighthouseResult {
	scores: LighthouseScores;
	coreWebVitals: CoreWebVitals;
}

/**
 * Run Lighthouse audit on a URL programmatically.
 * Returns null if Lighthouse fails (non-blocking).
 */
export async function runLighthouse(url: string): Promise<LighthouseResult | null> {
	try {
		const lighthouse = await import('lighthouse');
		const { chromium } = await import('playwright');

		// Use system Chromium if available, otherwise Playwright's bundled one
		const chromePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath();

		// Let Lighthouse launch and manage Chrome itself — much more reliable than manual spawn
		const runnerResult = await Promise.race([
			lighthouse.default(url, {
				output: 'json',
				onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
				chromePath,
				chromeFlags: [
					'--headless=new',
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--disable-dev-shm-usage',
					'--disable-gpu'
				]
			}),
			new Promise<null>((_, reject) =>
				setTimeout(() => reject(new Error('Lighthouse timeout')), LH_TIMEOUT)
			)
		]);

		if (!runnerResult || !runnerResult.lhr) return null;

		const { lhr } = runnerResult;

		const scores: LighthouseScores = {
			performance: lhr.categories?.performance?.score != null
				? Math.round(lhr.categories.performance.score * 100)
				: null,
			accessibility: lhr.categories?.accessibility?.score != null
				? Math.round(lhr.categories.accessibility.score * 100)
				: null,
			bestPractices: lhr.categories?.['best-practices']?.score != null
				? Math.round(lhr.categories['best-practices'].score * 100)
				: null,
			seo: lhr.categories?.seo?.score != null
				? Math.round(lhr.categories.seo.score * 100)
				: null
		};

		const audits = lhr.audits || {};
		const coreWebVitals: CoreWebVitals = {
			lcp: audits['largest-contentful-paint']?.numericValue ?? null,
			fid: audits['max-potential-fid']?.numericValue ?? null,
			cls: audits['cumulative-layout-shift']?.numericValue ?? null,
			fcp: audits['first-contentful-paint']?.numericValue ?? null,
			ttfb: audits['server-response-time']?.numericValue ?? null
		};

		return { scores, coreWebVitals };
	} catch (error) {
		console.error('Lighthouse failed:', error instanceof Error ? error.message : error);
		return null;
	}
}
