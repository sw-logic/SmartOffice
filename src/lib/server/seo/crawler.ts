import { type Page } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import type { CrawlResult } from './types';
import { getBrowser, closeBrowser } from '$lib/server/screenshot';

export { closeBrowser };

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/uploads';
const NAV_TIMEOUT = 30000;

async function extractDomData(page: Page): Promise<Omit<CrawlResult, 'url' | 'statusCode' | 'loadTimeMs' | 'desktopScreenshotPath' | 'mobileScreenshotPath'>> {
	return page.evaluate(() => {
		const getMetaContent = (name: string): string => {
			const el =
				document.querySelector(`meta[name="${name}"]`) ||
				document.querySelector(`meta[property="${name}"]`);
			return el?.getAttribute('content') || '';
		};

		// Title
		const title = document.title || '';

		// Meta
		const metaDescription = getMetaContent('description');
		const metaKeywords = getMetaContent('keywords');

		// Canonical
		const canonicalEl = document.querySelector('link[rel="canonical"]');
		const canonicalUrl = canonicalEl?.getAttribute('href') || '';

		// Open Graph
		const ogTags: Record<string, string> = {};
		document.querySelectorAll('meta[property^="og:"]').forEach(el => {
			const prop = el.getAttribute('property');
			const content = el.getAttribute('content');
			if (prop && content) ogTags[prop] = content;
		});

		// Headings
		const headings: { level: number; text: string }[] = [];
		document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
			headings.push({
				level: parseInt(el.tagName.charAt(1)),
				text: (el.textContent || '').trim().substring(0, 200)
			});
		});

		// Images
		const images: { src: string; alt: string; hasAlt: boolean }[] = [];
		document.querySelectorAll('img').forEach(el => {
			images.push({
				src: el.getAttribute('src') || '',
				alt: el.getAttribute('alt') || '',
				hasAlt: el.hasAttribute('alt') && (el.getAttribute('alt') || '').trim().length > 0
			});
		});

		// Links
		const links: { href: string; text: string; isExternal: boolean }[] = [];
		const currentHost = window.location.hostname;
		document.querySelectorAll('a[href]').forEach(el => {
			const href = el.getAttribute('href') || '';
			let isExternal = false;
			try {
				const linkUrl = new URL(href, window.location.href);
				isExternal = linkUrl.hostname !== currentHost;
			} catch {
				// relative or invalid
			}
			links.push({
				href,
				text: (el.textContent || '').trim().substring(0, 200),
				isExternal
			});
		});

		// Word count
		const bodyText = document.body?.innerText || '';
		const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

		// Robots meta
		const hasRobotsMeta = getMetaContent('robots');

		// Viewport
		const viewportMeta = document.querySelector('meta[name="viewport"]');
		const hasViewportMeta = !!viewportMeta;

		// Structured data (JSON-LD)
		const structuredData: unknown[] = [];
		document.querySelectorAll('script[type="application/ld+json"]').forEach(el => {
			try {
				structuredData.push(JSON.parse(el.textContent || ''));
			} catch {
				// skip invalid
			}
		});

		return {
			html: document.documentElement.outerHTML.substring(0, 100000), // cap at 100KB
			title,
			metaDescription,
			metaKeywords,
			canonicalUrl,
			ogTags,
			headings,
			images,
			links,
			wordCount,
			hasRobotsMeta,
			hasViewportMeta,
			structuredData
		};
	});
}

export async function crawlUrl(url: string, auditId: number, urlIndex: number): Promise<CrawlResult> {
	const b = await getBrowser();
	const screenshotDir = join(UPLOAD_DIR, 'seo-audits', String(auditId));
	await mkdir(screenshotDir, { recursive: true });

	// Desktop crawl
	const desktopContext = await b.newContext({
		viewport: { width: 1920, height: 1080 },
		userAgent:
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
	});

	const page = await desktopContext.newPage();
	const startTime = Date.now();
	let statusCode = 0;

	try {
		const response = await page.goto(url, {
			waitUntil: 'networkidle',
			timeout: NAV_TIMEOUT
		});
		statusCode = response?.status() ?? 0;
	} catch {
		// Timeout or nav error — extract whatever we can
		statusCode = 0;
	}

	const loadTimeMs = Date.now() - startTime;

	// Extract DOM data
	const domData = await extractDomData(page);

	// Desktop screenshot
	let desktopScreenshotPath: string | null = null;
	try {
		const desktopFile = `${urlIndex}_desktop.png`;
		const desktopFullPath = join(screenshotDir, desktopFile);
		await page.screenshot({ path: desktopFullPath, fullPage: false });
		desktopScreenshotPath = `seo-audits/${auditId}/${desktopFile}`;
	} catch {
		// screenshot failed
	}

	await desktopContext.close();

	// Mobile screenshot
	let mobileScreenshotPath: string | null = null;
	try {
		const mobileContext = await b.newContext({
			viewport: { width: 375, height: 812 },
			userAgent:
				'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
			isMobile: true
		});
		const mobilePage = await mobileContext.newPage();
		await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT }).catch(() => {});
		const mobileFile = `${urlIndex}_mobile.png`;
		const mobileFullPath = join(screenshotDir, mobileFile);
		await mobilePage.screenshot({ path: mobileFullPath, fullPage: false });
		mobileScreenshotPath = `seo-audits/${auditId}/${mobileFile}`;
		await mobileContext.close();
	} catch {
		// mobile screenshot failed
	}

	return {
		url,
		statusCode,
		loadTimeMs,
		desktopScreenshotPath,
		mobileScreenshotPath,
		...domData
	};
}
