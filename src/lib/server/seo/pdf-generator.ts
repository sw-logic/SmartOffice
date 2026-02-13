import jsPDF from 'jspdf';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { SeoUrlResult, SeoAuditSummary, SeoIssue } from './types';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/uploads';

// Page dimensions and margins
const PAGE_W = 210; // A4 width
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

function addHeader(doc: jsPDF, text: string, y: number, size = 16): number {
	doc.setFontSize(size);
	doc.setFont('helvetica', 'bold');
	doc.text(text, MARGIN, y);
	return y + size * 0.5 + 2;
}

function addText(doc: jsPDF, text: string, y: number, size = 10): number {
	doc.setFontSize(size);
	doc.setFont('helvetica', 'normal');
	const lines = doc.splitTextToSize(text, CONTENT_W);
	doc.text(lines, MARGIN, y);
	return y + lines.length * (size * 0.4) + 2;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
	if (y + needed > 280) {
		doc.addPage();
		return 20;
	}
	return y;
}

function severityColor(severity: string): [number, number, number] {
	switch (severity) {
		case 'critical': return [239, 68, 68];
		case 'warning': return [245, 158, 11];
		default: return [59, 130, 246];
	}
}

async function addImageFromFile(
	doc: jsPDF,
	relativePath: string,
	x: number,
	y: number,
	maxW: number,
	maxH: number
): Promise<number> {
	try {
		const fullPath = join(UPLOAD_DIR, relativePath);
		const buffer = await readFile(fullPath);
		const base64 = buffer.toString('base64');
		const imgData = `data:image/png;base64,${base64}`;
		doc.addImage(imgData, 'PNG', x, y, maxW, maxH);
		return y + maxH + 5;
	} catch {
		return y;
	}
}

async function addChartImage(doc: jsPDF, chartBuffer: Buffer, x: number, y: number, w: number, h: number): Promise<number> {
	try {
		const base64 = chartBuffer.toString('base64');
		const imgData = `data:image/png;base64,${base64}`;
		doc.addImage(imgData, 'PNG', x, y, w, h);
		return y + h + 5;
	} catch {
		return y;
	}
}

function addIssuesTable(doc: jsPDF, issues: SeoIssue[], startY: number): number {
	let y = startY;

	for (const issue of issues) {
		y = checkPageBreak(doc, y, 20);

		// Severity badge
		const [r, g, b] = severityColor(issue.severity);
		doc.setFillColor(r, g, b);
		doc.roundedRect(MARGIN, y - 3, 18, 5, 1, 1, 'F');
		doc.setFontSize(7);
		doc.setTextColor(255, 255, 255);
		doc.setFont('helvetica', 'bold');
		doc.text(issue.severity.toUpperCase(), MARGIN + 1, y + 0.5);
		doc.setTextColor(0, 0, 0);

		// Title
		doc.setFontSize(9);
		doc.setFont('helvetica', 'bold');
		doc.text(issue.title, MARGIN + 20, y + 0.5);
		y += 5;

		// Description
		doc.setFontSize(8);
		doc.setFont('helvetica', 'normal');
		const descLines = doc.splitTextToSize(issue.description, CONTENT_W - 20);
		doc.text(descLines, MARGIN + 20, y);
		y += descLines.length * 3.5 + 2;

		// Recommendation
		doc.setFontSize(8);
		doc.setTextColor(34, 139, 34);
		const recLines = doc.splitTextToSize(`→ ${issue.recommendation}`, CONTENT_W - 20);
		doc.text(recLines, MARGIN + 20, y);
		doc.setTextColor(0, 0, 0);
		y += recLines.length * 3.5 + 4;
	}

	return y;
}

export async function generatePdfReport(
	auditId: number,
	urls: string[],
	results: SeoUrlResult[],
	summary: SeoAuditSummary,
	charts: {
		radarCharts: Map<number, Buffer>;
		issuesChart: Buffer | null;
		categoryChart: Buffer | null;
	}
): Promise<string> {
	const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

	// =============================================
	// COVER PAGE
	// =============================================
	doc.setFillColor(30, 41, 59); // slate-800
	doc.rect(0, 0, PAGE_W, 60, 'F');

	doc.setTextColor(255, 255, 255);
	doc.setFontSize(28);
	doc.setFont('helvetica', 'bold');
	doc.text('SEO Audit Report', MARGIN, 35);

	doc.setFontSize(12);
	doc.setFont('helvetica', 'normal');
	doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), MARGIN, 48);

	doc.setTextColor(0, 0, 0);
	let y = 75;

	// Overall score circle
	doc.setFontSize(14);
	doc.setFont('helvetica', 'bold');
	doc.text('Overall Score', MARGIN, y);
	y += 8;

	const scoreColor = summary.overallScore >= 80 ? [16, 185, 129] : summary.overallScore >= 50 ? [245, 158, 11] : [239, 68, 68];
	doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
	doc.circle(MARGIN + 15, y + 10, 15, 'F');
	doc.setTextColor(255, 255, 255);
	doc.setFontSize(18);
	doc.text(String(summary.overallScore), MARGIN + 15, y + 12, { align: 'center' });
	doc.setTextColor(0, 0, 0);
	y += 35;

	// URLs audited
	doc.setFontSize(12);
	doc.setFont('helvetica', 'bold');
	doc.text('URLs Audited', MARGIN, y);
	y += 7;

	doc.setFontSize(9);
	doc.setFont('helvetica', 'normal');
	for (const url of urls) {
		y = checkPageBreak(doc, y, 6);
		doc.text(`• ${url}`, MARGIN + 3, y);
		y += 5;
	}

	// Issue counts
	y += 5;
	doc.setFontSize(10);
	doc.setFont('helvetica', 'bold');
	doc.text(
		`Issues: ${summary.totalIssues.critical} Critical  |  ${summary.totalIssues.warning} Warnings  |  ${summary.totalIssues.info} Info`,
		MARGIN, y
	);

	// =============================================
	// EXECUTIVE SUMMARY PAGE
	// =============================================
	doc.addPage();
	y = 20;
	y = addHeader(doc, 'Executive Summary', y, 18);
	y += 3;

	// Render executive summary as wrapped text (strip markdown for PDF)
	const plainSummary = summary.executiveSummary
		.replace(/#{1,6}\s*/g, '')
		.replace(/\*\*/g, '')
		.replace(/\*/g, '')
		.replace(/- /g, '• ');
	y = addText(doc, plainSummary, y, 10);
	y += 5;

	// Charts
	if (charts.categoryChart) {
		y = checkPageBreak(doc, y, 80);
		y = await addChartImage(doc, charts.categoryChart, MARGIN, y, 90, 70);
	}

	if (charts.issuesChart) {
		y = checkPageBreak(doc, y, 80);
		y = await addChartImage(doc, charts.issuesChart, MARGIN, y, 90, 70);
	}

	// =============================================
	// PER-URL SECTIONS
	// =============================================
	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		doc.addPage();
		y = 20;

		// URL header
		doc.setFillColor(241, 245, 249); // slate-100
		doc.rect(0, y - 8, PAGE_W, 14, 'F');
		doc.setFontSize(11);
		doc.setFont('helvetica', 'bold');
		doc.setTextColor(30, 41, 59);
		const displayUrl = result.url.length > 80 ? result.url.substring(0, 77) + '...' : result.url;
		doc.text(`${i + 1}. ${displayUrl}`, MARGIN, y);
		doc.setTextColor(0, 0, 0);
		y += 12;

		if (result.status === 'error') {
			doc.setTextColor(239, 68, 68);
			y = addText(doc, `Error: ${result.error || 'Failed to audit'}`, y);
			doc.setTextColor(0, 0, 0);
			continue;
		}

		// Quick stats
		if (result.crawl) {
			doc.setFontSize(9);
			doc.setFont('helvetica', 'normal');
			doc.text([
				`Status: ${result.crawl.statusCode}`,
				`Load Time: ${(result.crawl.loadTimeMs / 1000).toFixed(1)}s`,
				`Word Count: ${result.crawl.wordCount}`,
				`Images: ${result.crawl.images.length}`,
				`Links: ${result.crawl.links.length}`
			].join('  |  '), MARGIN, y);
			y += 8;
		}

		// Screenshots side by side
		if (result.crawl?.desktopScreenshotPath || result.crawl?.mobileScreenshotPath) {
			y = checkPageBreak(doc, y, 60);
			y = addHeader(doc, 'Screenshots', y, 11);

			if (result.crawl.desktopScreenshotPath) {
				y = await addImageFromFile(doc, result.crawl.desktopScreenshotPath, MARGIN, y, 85, 48);
			}
			if (result.crawl.mobileScreenshotPath) {
				const mobileY = result.crawl.desktopScreenshotPath ? y - 53 : y;
				await addImageFromFile(doc, result.crawl.mobileScreenshotPath, MARGIN + 90, mobileY, 25, 48);
				if (!result.crawl.desktopScreenshotPath) y += 53;
			}
		}

		// Lighthouse scores radar
		const radarChart = charts.radarCharts.get(i);
		if (radarChart) {
			y = checkPageBreak(doc, y, 75);
			y = addHeader(doc, 'Lighthouse Scores', y, 11);
			y = await addChartImage(doc, radarChart, MARGIN, y, 80, 65);
		}

		// Core Web Vitals
		if (result.coreWebVitals) {
			y = checkPageBreak(doc, y, 25);
			y = addHeader(doc, 'Core Web Vitals', y, 11);
			doc.setFontSize(9);
			doc.setFont('helvetica', 'normal');
			const cwv = result.coreWebVitals;
			const vitals = [
				`LCP: ${cwv.lcp != null ? (cwv.lcp / 1000).toFixed(2) + 's' : 'N/A'}`,
				`FCP: ${cwv.fcp != null ? (cwv.fcp / 1000).toFixed(2) + 's' : 'N/A'}`,
				`CLS: ${cwv.cls != null ? cwv.cls.toFixed(3) : 'N/A'}`,
				`TTFB: ${cwv.ttfb != null ? cwv.ttfb.toFixed(0) + 'ms' : 'N/A'}`
			].join('  |  ');
			doc.text(vitals, MARGIN, y);
			y += 8;
		}

		// Issues
		if (result.issues.length > 0) {
			y = checkPageBreak(doc, y, 15);
			y = addHeader(doc, `Issues (${result.issues.length})`, y, 11);
			y = addIssuesTable(doc, result.issues, y);
		}

		// AI Analysis
		if (result.aiAnalysis) {
			y = checkPageBreak(doc, y, 30);
			y = addHeader(doc, 'Content Analysis (AI)', y, 11);
			doc.setFontSize(9);
			doc.setFont('helvetica', 'normal');
			doc.text([
				`Quality: ${result.aiAnalysis.contentQuality}/10`,
				`Readability: ${result.aiAnalysis.readability}/10`,
				`Keyword Relevance: ${result.aiAnalysis.keywordRelevance}/10`
			].join('  |  '), MARGIN, y);
			y += 6;
			y = addText(doc, result.aiAnalysis.summary, y, 9);
		}
	}

	// =============================================
	// SAVE PDF
	// =============================================
	const pdfDir = join(UPLOAD_DIR, 'seo-audits', String(auditId));
	const pdfRelativePath = `seo-audits/${auditId}/report.pdf`;
	const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

	const { mkdir, writeFile } = await import('fs/promises');
	await mkdir(pdfDir, { recursive: true });
	await writeFile(join(pdfDir, 'report.pdf'), pdfBuffer);

	return pdfRelativePath;
}
