import type { LighthouseScores, CoreWebVitals } from './types';

const LH_TIMEOUT = 60000;

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
		// Dynamic import to avoid bundling issues
		const lighthouse = await import('lighthouse');
		const { chromium } = await import('playwright');

		// Get Playwright's Chromium executable path
		const executablePath = chromium.executablePath();

		// Launch Chrome for Lighthouse (it needs its own instance)
		const chrome = await import('child_process').then(cp => {
			return new Promise<{ port: number; process: ReturnType<typeof cp.spawn> }>((resolve, reject) => {
				const proc = cp.spawn(executablePath, [
					'--headless',
					'--disable-gpu',
					'--no-sandbox',
					'--remote-debugging-port=0',
					'--disable-setuid-sandbox'
				], { stdio: ['pipe', 'pipe', 'pipe'] });

				let stderr = '';
				proc.stderr?.on('data', (data: Buffer) => {
					stderr += data.toString();
					// Look for the DevTools listening message
					const match = stderr.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
					if (match) {
						resolve({ port: parseInt(match[1]), process: proc });
					}
				});

				proc.on('error', reject);

				// Timeout
				setTimeout(() => {
					proc.kill();
					reject(new Error('Chrome launch timeout'));
				}, 15000);
			});
		});

		try {
			const runnerResult = await Promise.race([
				lighthouse.default(url, {
					port: chrome.port,
					output: 'json',
					onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
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
		} finally {
			chrome.process.kill();
		}
	} catch (error) {
		console.error('Lighthouse failed:', error instanceof Error ? error.message : error);
		return null;
	}
}
