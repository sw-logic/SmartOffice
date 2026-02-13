import type { LighthouseScores, CoreWebVitals } from './types';

const LH_TIMEOUT = 90000;

export interface LighthouseResult {
	scores: LighthouseScores;
	coreWebVitals: CoreWebVitals;
	error?: string;
}

/**
 * Resolve the Chromium executable path.
 * Docker: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH env var
 * Local: Playwright's bundled Chromium
 */
async function resolveChromePath(): Promise<string> {
	if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
		return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
	}
	// Use Playwright's bundled Chromium (works on Windows, macOS, Linux)
	const { chromium } = await import('playwright');
	return chromium.executablePath();
}

/**
 * Run Lighthouse audit on a URL programmatically.
 * Launches Chrome via chrome-launcher, runs Lighthouse, then kills Chrome.
 * Returns { error } if Lighthouse fails (non-blocking).
 */
export async function runLighthouse(url: string): Promise<LighthouseResult | { error: string }> {
	let chrome: { port: number; kill: () => void } | null = null;

	try {
		const chromeLauncher = await import('chrome-launcher');
		const lighthouse = await import('lighthouse');

		const chromePath = await resolveChromePath();

		// Launch Chrome ourselves so we control the path and flags
		chrome = await chromeLauncher.launch({
			chromePath,
			chromeFlags: [
				'--headless=new',
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-gpu'
			]
		});

		// Pass the port to Lighthouse so it connects to our Chrome instance
		const flags = {
			output: 'json' as const,
			onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
			port: chrome!.port
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
	} finally {
		// Always kill Chrome to prevent zombie processes
		try { chrome?.kill(); } catch { /* ignore */ }
	}
}
