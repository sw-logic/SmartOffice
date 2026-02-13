import type { LighthouseScores, CoreWebVitals } from './types';

const LH_TIMEOUT = 90000;

export interface LighthouseResult {
	scores: LighthouseScores;
	coreWebVitals: CoreWebVitals;
	error?: string;
}

/**
 * Run Lighthouse audit on a URL programmatically.
 * Returns { error } if Lighthouse fails (non-blocking).
 */
export async function runLighthouse(url: string): Promise<LighthouseResult | { error: string }> {
	try {
		const lighthouse = await import('lighthouse');

		// In Docker: use system Chromium via env var
		// Locally: omit chromePath so chrome-launcher finds installed Chrome automatically
		const chromePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

		// Let Lighthouse launch and manage Chrome itself via chrome-launcher
		// chromeFlags/chromePath are accepted at runtime but missing from LH.Flags types
		const flags = {
			output: 'json' as const,
			onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
			...(chromePath ? { chromePath } : {}),
			chromeFlags: [
				'--headless=new',
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-gpu'
			]
		};
		const runnerResult = await Promise.race([
			lighthouse.default(url, flags as Parameters<typeof lighthouse.default>[1]),
			new Promise<null>((_, reject) =>
				setTimeout(() => reject(new Error(`Lighthouse timeout after ${LH_TIMEOUT / 1000}s`)), LH_TIMEOUT)
			)
		]);

		if (!runnerResult || !runnerResult.lhr) {
			return { error: 'Lighthouse returned no results (runnerResult or lhr is null)' };
		}

		const { lhr } = runnerResult;

		// Check for Lighthouse runtime errors
		if (lhr.runtimeError) {
			return { error: `Lighthouse runtime error: ${lhr.runtimeError.message || lhr.runtimeError.code || 'unknown'}` };
		}

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
		const msg = error instanceof Error ? error.message : String(error);
		console.error('Lighthouse failed:', msg);
		return { error: `Lighthouse failed: ${msg}` };
	}
}
