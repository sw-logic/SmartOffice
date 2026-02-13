import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import type { ChartConfiguration } from 'chart.js';
import type { LighthouseScores, SeoIssue } from './types';

const CHART_WIDTH = 500;
const CHART_HEIGHT = 400;

const chartCanvas = new ChartJSNodeCanvas({
	width: CHART_WIDTH,
	height: CHART_HEIGHT,
	backgroundColour: 'white'
});

/**
 * Generate a radar chart of Lighthouse category scores.
 */
export async function generateScoresRadarChart(scores: LighthouseScores): Promise<Buffer> {
	const config: ChartConfiguration = {
		type: 'radar',
		data: {
			labels: ['Performance', 'Accessibility', 'Best Practices', 'SEO'],
			datasets: [{
				label: 'Score',
				data: [
					scores.performance ?? 0,
					scores.accessibility ?? 0,
					scores.bestPractices ?? 0,
					scores.seo ?? 0
				],
				backgroundColor: 'rgba(59, 130, 246, 0.2)',
				borderColor: 'rgb(59, 130, 246)',
				borderWidth: 2,
				pointBackgroundColor: 'rgb(59, 130, 246)'
			}]
		},
		options: {
			scales: {
				r: {
					beginAtZero: true,
					max: 100,
					ticks: { stepSize: 20 }
				}
			},
			plugins: {
				title: {
					display: true,
					text: 'Lighthouse Scores',
					font: { size: 16 }
				}
			}
		}
	};

	return chartCanvas.renderToBuffer(config);
}

/**
 * Generate a bar chart showing issue severity breakdown.
 */
export async function generateIssuesBreakdownChart(issues: SeoIssue[]): Promise<Buffer> {
	const critical = issues.filter(i => i.severity === 'critical').length;
	const warning = issues.filter(i => i.severity === 'warning').length;
	const info = issues.filter(i => i.severity === 'info').length;

	const config: ChartConfiguration = {
		type: 'bar',
		data: {
			labels: ['Critical', 'Warning', 'Info'],
			datasets: [{
				label: 'Issues',
				data: [critical, warning, info],
				backgroundColor: ['#EF4444', '#F59E0B', '#3B82F6'],
				borderColor: ['#DC2626', '#D97706', '#2563EB'],
				borderWidth: 1
			}]
		},
		options: {
			scales: {
				y: {
					beginAtZero: true,
					ticks: { stepSize: 1 }
				}
			},
			plugins: {
				title: {
					display: true,
					text: 'Issues by Severity',
					font: { size: 16 }
				}
			}
		}
	};

	return chartCanvas.renderToBuffer(config);
}

/**
 * Generate a bar chart of overall category scores.
 */
export async function generateCategoryScoresBarChart(
	categoryScores: { technical: number; content: number; performance: number; accessibility: number }
): Promise<Buffer> {
	const config: ChartConfiguration = {
		type: 'bar',
		data: {
			labels: ['Technical', 'Content', 'Performance', 'Accessibility'],
			datasets: [{
				label: 'Score',
				data: [
					categoryScores.technical,
					categoryScores.content,
					categoryScores.performance,
					categoryScores.accessibility
				],
				backgroundColor: [
					'rgba(59, 130, 246, 0.7)',
					'rgba(16, 185, 129, 0.7)',
					'rgba(245, 158, 11, 0.7)',
					'rgba(139, 92, 246, 0.7)'
				],
				borderColor: [
					'rgb(59, 130, 246)',
					'rgb(16, 185, 129)',
					'rgb(245, 158, 11)',
					'rgb(139, 92, 246)'
				],
				borderWidth: 1
			}]
		},
		options: {
			scales: {
				y: {
					beginAtZero: true,
					max: 100,
					ticks: { stepSize: 20 }
				}
			},
			plugins: {
				title: {
					display: true,
					text: 'Category Scores',
					font: { size: 16 }
				}
			}
		}
	};

	return chartCanvas.renderToBuffer(config);
}
