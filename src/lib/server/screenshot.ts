import { chromium, type Browser } from 'playwright';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
	if (!browser || !browser.isConnected()) {
		browser = await chromium.launch({
			headless: true,
			executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
			args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
		});
	}
	return browser;
}

export async function closeBrowser(): Promise<void> {
	if (browser && browser.isConnected()) {
		await browser.close();
		browser = null;
	}
}

/**
 * Capture a desktop screenshot of a URL and save it to the given absolute path.
 * Returns the relative path (for DB storage) on success, or null on failure.
 */
export async function captureScreenshot(
	url: string,
	absolutePath: string,
	relativePath: string
): Promise<string | null> {
	try {
		const b = await getBrowser();
		await mkdir(dirname(absolutePath), { recursive: true });

		const context = await b.newContext({
			viewport: { width: 1920, height: 1080 },
			userAgent:
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
		});

		const page = await context.newPage();
		try {
			await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
			await page.screenshot({ path: absolutePath, fullPage: false });
			return relativePath;
		} finally {
			await context.close();
		}
	} catch {
		return null;
	}
}
