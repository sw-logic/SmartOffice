<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import Metric from '$lib/components/shared/Metric.svelte';
	import MarkdownViewer from '$lib/components/shared/MarkdownViewer.svelte';
	import {
		ArrowLeft,
		Download,
		Trash2,
		Loader2,
		Globe,
		Gauge,
		ShieldCheck,
		Zap,
		Eye,
		AlertTriangle,
		AlertCircle,
		Info,
		ExternalLink,
		Image,
		Link2,
		FileText,
		Clock,
		CheckCircle2,
		XCircle,
		Monitor,
		Smartphone,
		Search,
		Brain,
		BarChart3,
		ChevronDown,
		ChevronRight
	} from 'lucide-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();
	const audit = data.audit;

	const LANGUAGE_LABELS: Record<string, string> = {
		en: 'English', hu: 'Magyar', de: 'Deutsch', fr: 'Français', es: 'Español',
		it: 'Italiano', pt: 'Português', nl: 'Nederlands', pl: 'Polski', cs: 'Čeština',
		sk: 'Slovenčina', ro: 'Română', hr: 'Hrvatski', sr: 'Srpski', bg: 'Български',
		ru: 'Русский', uk: 'Українська', ja: '日本語', zh: '中文', ko: '한국어'
	};

	let deleteDialogOpen = $state(false);
	let isDeleting = $state(false);

	// Collapsible sections state (all open by default)
	let openSections = $state<Record<string, boolean>>({
		'top-issues': true,
		...Object.fromEntries(audit.results.map((_: unknown, i: number) => [`issues-${i}`, true]))
	});

	// Active tab for per-URL results
	let activeUrlTab = $state(audit.urls[0] ?? '');

	function scoreColor(score: number | null | undefined): string {
		if (score == null) return 'text-muted-foreground';
		if (score >= 80) return 'text-green-600';
		if (score >= 50) return 'text-yellow-600';
		return 'text-red-600';
	}

	function scoreBg(score: number | null | undefined): string {
		if (score == null) return 'bg-muted';
		if (score >= 80) return 'bg-green-100 dark:bg-green-950';
		if (score >= 50) return 'bg-yellow-100 dark:bg-yellow-950';
		return 'bg-red-100 dark:bg-red-950';
	}

	function severityIcon(severity: string) {
		switch (severity) {
			case 'critical': return AlertTriangle;
			case 'warning': return AlertCircle;
			default: return Info;
		}
	}

	function severityColor(severity: string): string {
		switch (severity) {
			case 'critical': return 'text-red-600';
			case 'warning': return 'text-yellow-600';
			default: return 'text-blue-600';
		}
	}

	function severityBadgeVariant(severity: string): 'destructive' | 'default' | 'secondary' | 'outline' {
		switch (severity) {
			case 'critical': return 'destructive';
			case 'warning': return 'default';
			default: return 'secondary';
		}
	}

	function formatMs(ms: number | null): string {
		if (ms == null) return 'N/A';
		if (ms < 1000) return `${Math.round(ms)}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}

	function formatDuration(startedAt: string | null, completedAt: string | null): string {
		if (!startedAt || !completedAt) return '-';
		const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
		if (ms < 60000) return `${Math.round(ms / 1000)}s`;
		return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
	}

	async function handleDelete() {
		isDeleting = true;
		try {
			const res = await fetch(`/api/tools/seo-audit/${audit.id}`, { method: 'DELETE' });
			if (res.ok) {
				toast.success('Audit deleted');
				goto('/tools/seo-audit');
			} else {
				const body = await res.json().catch(() => ({}));
				toast.error(body.message || 'Failed to delete');
			}
		} catch {
			toast.error('Network error');
		} finally {
			isDeleting = false;
			deleteDialogOpen = false;
		}
	}
</script>

<svelte:head>
	<title>SEO Audit #{audit.id} - SmartOffice</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" href="/tools/seo-audit">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-bold">SEO Audit #{audit.id}</h1>
					<Badge
						variant={audit.status === 'completed' ? 'outline' : audit.status === 'failed' ? 'destructive' : 'default'}
					>
						{audit.status === 'completed' ? 'Completed' : audit.status === 'failed' ? 'Failed' : audit.status}
					</Badge>
				</div>
				<p class="text-sm text-muted-foreground">
					{formatDate(audit.createdAt)} &middot; {audit.urls.length} URL{audit.urls.length !== 1 ? 's' : ''}
					&middot; {LANGUAGE_LABELS[audit.language] || audit.language}
					&middot; by {audit.createdBy.name}
					{#if audit.startedAt && audit.completedAt}
						&middot; {formatDuration(audit.startedAt, audit.completedAt)}
					{/if}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			{#if audit.pdfPath}
				<Button
					variant="outline"
					onclick={() => window.open(`/api/tools/seo-audit/${audit.id}/pdf`, '_blank')}
				>
					<Download class="mr-2 h-4 w-4" />
					Download PDF
				</Button>
			{/if}
			{#if data.canDelete && audit.status !== 'running'}
				<Button variant="destructive" onclick={() => (deleteDialogOpen = true)}>
					<Trash2 class="mr-2 h-4 w-4" />
					Delete
				</Button>
			{/if}
		</div>
	</div>

	<!-- Error message for failed audits -->
	{#if audit.status === 'failed' && audit.error}
		<Card.Root class="border-destructive">
			<Card.Content class="flex items-center gap-3 py-4">
				<XCircle class="h-5 w-5 text-destructive shrink-0" />
				<p class="text-sm text-destructive">{audit.error}</p>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Summary Section (only for completed audits) -->
	{#if audit.summary}
		{@const summary = audit.summary}

		<!-- Score Cards Row -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
			<!-- Overall Score -->
			<Card.Root class={scoreBg(summary.overallScore)}>
				<Card.Content class="flex flex-col items-center justify-center">
					<span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overall</span>
					<span class="text-4xl font-bold {scoreColor(summary.overallScore)}">
						{summary.overallScore}
					</span>
					<span class="text-xs text-muted-foreground">/ 100</span>
				</Card.Content>
			</Card.Root>

			<!-- Category Scores -->
			<Card.Root>
				<Card.Content class="flex flex-col items-center justify-center">
					<ShieldCheck class="h-5 w-5 text-muted-foreground mb-1" />
					<span class="text-xs text-muted-foreground">Technical</span>
					<span class="text-2xl font-bold {scoreColor(summary.categoryScores.technical)}">
						{summary.categoryScores.technical}
					</span>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Content class="flex flex-col items-center justify-center">
					<FileText class="h-5 w-5 text-muted-foreground mb-1" />
					<span class="text-xs text-muted-foreground">Content</span>
					<span class="text-2xl font-bold {scoreColor(summary.categoryScores.content)}">
						{summary.categoryScores.content}
					</span>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Content class="flex flex-col items-center justify-center">
					<Zap class="h-5 w-5 text-muted-foreground mb-1" />
					<span class="text-xs text-muted-foreground">Performance</span>
					<span class="text-2xl font-bold {scoreColor(summary.categoryScores.performance)}">
						{summary.categoryScores.performance}
					</span>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Content class="flex flex-col items-center justify-center">
					<Eye class="h-5 w-5 text-muted-foreground mb-1" />
					<span class="text-xs text-muted-foreground">Accessibility</span>
					<span class="text-2xl font-bold {scoreColor(summary.categoryScores.accessibility)}">
						{summary.categoryScores.accessibility}
					</span>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Issue Summary + Executive Summary -->
		<div class="grid gap-4 lg:grid-cols-5">
			<!-- Issue Breakdown -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<BarChart3 class="h-5 w-5" />
						Issue Summary
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<AlertTriangle class="h-4 w-4 text-red-600" />
							<span class="text-sm">Critical</span>
						</div>
						<span class="text-lg font-bold text-red-600">{summary.totalIssues.critical}</span>
					</div>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<AlertCircle class="h-4 w-4 text-yellow-600" />
							<span class="text-sm">Warnings</span>
						</div>
						<span class="text-lg font-bold text-yellow-600">{summary.totalIssues.warning}</span>
					</div>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Info class="h-4 w-4 text-blue-600" />
							<span class="text-sm">Info</span>
						</div>
						<span class="text-lg font-bold text-blue-600">{summary.totalIssues.info}</span>
					</div>

					<Separator />

					<div class="flex items-center justify-between font-medium">
						<span>Total Issues</span>
						<span class="text-lg">
							{summary.totalIssues.critical + summary.totalIssues.warning + summary.totalIssues.info}
						</span>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Executive Summary -->
			<Card.Root class="lg:col-span-4">
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<Brain class="h-5 w-5" />
						Executive Summary
					</Card.Title>
				</Card.Header>
				<Card.Content>
					{#if summary.executiveSummary}
						<MarkdownViewer value={summary.executiveSummary} />
					{:else}
						<p class="text-muted-foreground">No summary available.</p>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Top Issues -->
		{#if summary.topIssues.length > 0}
			{@const id = 'top-issues'}
			<Card.Root class="py-0">
				<Collapsible.Root bind:open={openSections[id]}>
					<Collapsible.Trigger class="flex w-full items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors">
						<div class="flex items-center gap-2">
							{#if openSections[id]}
								<ChevronDown class="h-4 w-4" />
							{:else}
								<ChevronRight class="h-4 w-4" />
							{/if}
							<AlertTriangle class="h-5 w-5" />
							<span class="font-semibold">Top Issues Across All Pages</span>
							<Badge variant="secondary">{summary.topIssues.length}</Badge>
						</div>
					</Collapsible.Trigger>
					<Collapsible.Content>
						<div class="space-y-3 px-6 py-6">
							{#each summary.topIssues as issue}
								<div class="flex items-start gap-3 rounded-lg border p-3">
									<svelte:component
										this={severityIcon(issue.severity)}
										class="h-5 w-5 shrink-0 mt-0.5 {severityColor(issue.severity)}"
									/>
									<div class="grid grid-cols-4 gap-6 flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<span class="font-medium text-sm">{issue.title}</span>
											<Badge variant={severityBadgeVariant(issue.severity)} class="text-[10px] px-1.5 py-0">
												{issue.severity}
											</Badge>
											<Badge variant="outline" class="text-[10px] px-1.5 py-0">
												{issue.category}
											</Badge>
										</div>
										<p class="text-sm text-muted-foreground mt-0.5">{issue.description}</p>
										<p class="col-span-2 text-sm text-green-700 dark:text-green-400 mt-1">
											&rarr; {issue.recommendation}
										</p>
									</div>
								</div>
							{/each}
						</div>
					</Collapsible.Content>
				</Collapsible.Root>
			</Card.Root>
		{/if}
	{/if}

	<!-- Per-URL Results -->
	{#if audit.results.length > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Globe class="h-5 w-5" />
					Per-URL Results
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<Tabs.Root bind:value={activeUrlTab}>
					<Tabs.List class="flex-wrap h-auto gap-1">
						{#each audit.results as result, i}
							<Tabs.Trigger value={result.url} class="text-xs max-w-[200px] truncate">
								{i + 1}. {new URL(result.url).hostname}{new URL(result.url).pathname === '/' ? '' : new URL(result.url).pathname}
							</Tabs.Trigger>
						{/each}
					</Tabs.List>

					{#each audit.results as result, i}
						<Tabs.Content value={result.url} class="space-y-6 pt-4">
							<!-- URL Header -->
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2 min-w-0">
									<Globe class="h-4 w-4 shrink-0 text-muted-foreground" />
									<a
										href={result.url}
										target="_blank"
										rel="noopener noreferrer"
										class="text-sm font-mono text-blue-600 hover:underline truncate"
									>
										{result.url}
									</a>
									<ExternalLink class="h-3 w-3 shrink-0 text-muted-foreground" />
								</div>
								{#if result.status === 'error'}
									<Badge variant="destructive">Error</Badge>
								{/if}
							</div>

							{#if result.status === 'error'}
								<div class="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
									{result.error || 'Failed to audit this URL'}
								</div>
							{:else}

                                <div class="grid sm:grid-cols-2 gap-12">
                                    <!-- Screenshots -->
                                    {#if result.crawl?.desktopScreenshotPath || result.crawl?.mobileScreenshotPath}
                                        <div>
                                            <h4 class="text-sm font-medium mb-3 flex items-center gap-2">
                                                <Monitor class="h-4 w-4" />
                                                Screenshots
                                            </h4>
                                            <div class="flex gap-4 flex-wrap">
                                                {#if result.crawl.desktopScreenshotPath}
                                                    <div class="space-y-1">
                                                        <p class="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Monitor class="h-3 w-3" /> Desktop
                                                        </p>
                                                        <img
                                                                src="/api/uploads/{result.crawl.desktopScreenshotPath}"
                                                                alt="Desktop screenshot of {result.url}"
                                                                class="rounded-lg border shadow-sm max-w-[500px] w-full"
                                                        />
                                                    </div>
                                                {/if}
                                                {#if result.crawl.mobileScreenshotPath}
                                                    <div class="space-y-1">
                                                        <p class="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Smartphone class="h-3 w-3" /> Mobile
                                                        </p>
                                                        <img
                                                                src="/api/uploads/{result.crawl.mobileScreenshotPath}"
                                                                alt="Mobile screenshot of {result.url}"
                                                                class="rounded-lg border shadow-sm max-w-[180px]"
                                                        />
                                                    </div>
                                                {/if}
                                            </div>
                                        </div>
                                    {/if}
                                    {#if result.crawl}
                                        <div class="flex flex-col gap-4">
                                            <h4 class="text-sm font-medium mb-3 flex items-center gap-2">
                                                <Monitor class="h-4 w-4" />
                                                Elements
                                            </h4>
                                            <div class="flex justify-between pr-6">
                                                <p class="text-sm text-muted-foreground">Status</p>
                                                <p class="text-lg font-bold {result.crawl.statusCode >= 400 ? 'text-red-600' : result.crawl.statusCode >= 300 ? 'text-yellow-600' : 'text-green-600'}">
                                                    {result.crawl.statusCode || 'N/A'}
                                                </p>
                                            </div>
                                            <hr>
                                            <div class="flex justify-between pr-6">
                                                <p class="text-sm text-muted-foreground">Load Time</p>
                                                <p class="text-lg font-bold">{formatMs(result.crawl.loadTimeMs)}</p>
                                            </div>
                                            <hr>
                                            <div class="flex justify-between pr-6">
                                                <p class="text-sm text-muted-foreground">Words</p>
                                                <p class="text-lg font-bold">{result.crawl.wordCount}</p>
                                            </div>
                                            <hr>
                                            <div class="flex justify-between pr-6">
                                                <p class="text-sm text-muted-foreground">Images</p>
                                                <p class="text-lg font-bold">{result.crawl.images.length}</p>
                                            </div>
                                            <hr>
                                            <div class="flex justify-between pr-6">
                                                <p class="text-sm text-muted-foreground">Links</p>
                                                <p class="text-lg font-bold">{result.crawl.links.length}</p>
                                            </div>
                                        </div>
                                    {/if}
                                </div>

                                <hr>

                                <div class="grid sm:grid-cols-2 gap-12">
                                    <!-- Lighthouse Scores -->
                                    {#if result.lighthouseScores}
                                        {@const lh = result.lighthouseScores}
                                        <div>
                                            <h4 class="text-sm font-medium mb-3 flex items-center gap-2">
                                                <Gauge class="h-4 w-4" />
                                                Lighthouse Scores
                                            </h4>
                                            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                {#each [
                                                    { label: 'Performance', value: lh.performance },
                                                    { label: 'Accessibility', value: lh.accessibility },
                                                    { label: 'Best Practices', value: lh.bestPractices },
                                                    { label: 'SEO', value: lh.seo }
                                                ] as item}
                                                    <div class="rounded-lg border p-3 text-center {scoreBg(item.value)}">
                                                        <p class="text-xs text-muted-foreground">{item.label}</p>
                                                        <p class="text-2xl font-bold {scoreColor(item.value)}">
                                                            {item.value ?? 'N/A'}
                                                        </p>
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    {/if}

                                    <!-- Core Web Vitals -->
                                    {#if result.coreWebVitals}
                                        {@const cwv = result.coreWebVitals}
                                        <div>
                                            <h4 class="text-sm font-medium mb-3 flex items-center gap-2">
                                                <Zap class="h-4 w-4" />
                                                Core Web Vitals
                                            </h4>
                                            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                {#each [
                                                    { label: 'LCP', value: cwv.lcp, format: (v: number) => (v / 1000).toFixed(2) + 's' },
                                                    { label: 'FCP', value: cwv.fcp, format: (v: number) => (v / 1000).toFixed(2) + 's' },
                                                    { label: 'CLS', value: cwv.cls, format: (v: number) => v.toFixed(3) },
                                                    { label: 'TTFB', value: cwv.ttfb, format: (v: number) => Math.round(v) + 'ms' }
                                                ] as item}
                                                    <div class="rounded-lg border p-3 text-center">
                                                        <p class="text-xs text-muted-foreground">{item.label}</p>
                                                        <p class="text-lg font-bold">
                                                            {item.value != null ? item.format(item.value) : 'N/A'}
                                                        </p>
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    {/if}
                                </div>


                                <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <!-- Meta & Technical Info -->
                                    {#if result.crawl}
                                        <div class="flex flex-col gap-2">
                                            <h4 class="text-sm font-medium mb-3 flex items-center gap-2">
                                                <Search class="h-4 w-4" />
                                                Meta & Technical
                                            </h4>
                                            <div class="rounded-lg border overflow-hidden">
                                                <table class="w-full text-sm">
                                                    <tbody>
                                                    <tr class="border-b">
                                                        <td class="px-3 py-2 font-medium text-muted-foreground w-[140px]">Title</td>
                                                        <td class="px-3 py-2">
                                                            {result.crawl.title || '(empty)'}
                                                            {#if result.crawl.title}
                                                                <span class="text-xs text-muted-foreground ml-2">({result.crawl.title.length} chars)</span>
                                                            {/if}
                                                        </td>
                                                    </tr>
                                                    <tr class="border-b">
                                                        <td class="px-3 py-2 font-medium text-muted-foreground">Description</td>
                                                        <td class="px-3 py-2">
                                                            {result.crawl.metaDescription || '(empty)'}
                                                            {#if result.crawl.metaDescription}
                                                                <span class="text-xs text-muted-foreground ml-2">({result.crawl.metaDescription.length} chars)</span>
                                                            {/if}
                                                        </td>
                                                    </tr>
                                                    <tr class="border-b">
                                                        <td class="px-3 py-2 font-medium text-muted-foreground">Canonical</td>
                                                        <td class="px-3 py-2 font-mono text-xs">{result.crawl.canonicalUrl || '(none)'}</td>
                                                    </tr>
                                                    <tr class="border-b">
                                                        <td class="px-3 py-2 font-medium text-muted-foreground">Viewport</td>
                                                        <td class="px-3 py-2">
                                                            {#if result.crawl.hasViewportMeta}
                                                                <CheckCircle2 class="h-4 w-4 text-green-600 inline" /> Present
                                                            {:else}
                                                                <XCircle class="h-4 w-4 text-red-600 inline" /> Missing
                                                            {/if}
                                                        </td>
                                                    </tr>
                                                    <tr class="border-b">
                                                        <td class="px-3 py-2 font-medium text-muted-foreground">Sitemap</td>
                                                        <td class="px-3 py-2">
                                                            {#if result.hasSitemap}
                                                                <CheckCircle2 class="h-4 w-4 text-green-600 inline" /> Found
                                                            {:else if result.hasSitemap === false}
                                                                <XCircle class="h-4 w-4 text-red-600 inline" /> Not found
                                                            {:else}
                                                                <span class="text-muted-foreground">N/A</span>
                                                            {/if}
                                                        </td>
                                                    </tr>
                                                    <tr class="border-b">
                                                        <td class="px-3 py-2 font-medium text-muted-foreground">robots.txt</td>
                                                        <td class="px-3 py-2">
                                                            {#if result.hasRobotsTxt}
                                                                <CheckCircle2 class="h-4 w-4 text-green-600 inline" /> Found
                                                            {:else if result.hasRobotsTxt === false}
                                                                <XCircle class="h-4 w-4 text-red-600 inline" /> Not found
                                                            {:else}
                                                                <span class="text-muted-foreground">N/A</span>
                                                            {/if}
                                                        </td>
                                                    </tr>
                                                    <tr class="border-b">
                                                        <td class="px-3 py-2 font-medium text-muted-foreground">Structured Data</td>
                                                        <td class="px-3 py-2">
                                                            {result.crawl.structuredData.length > 0
                                                                ? `${result.crawl.structuredData.length} schema(s)`
                                                                : 'None'}
                                                        </td>
                                                    </tr>
                                                    {#if Object.keys(result.crawl.ogTags).length > 0}
                                                        <tr>
                                                            <td class="px-3 py-2 font-medium text-muted-foreground align-top">Open Graph</td>
                                                            <td class="px-3 py-2">
                                                                {#each Object.entries(result.crawl.ogTags) as [key, value]}
                                                                    <div class="text-xs">
                                                                        <span class="text-muted-foreground">{key}:</span> {value}
                                                                    </div>
                                                                {/each}
                                                            </td>
                                                        </tr>
                                                    {/if}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    {/if}

                                    <!-- Heading Structure -->
                                    {#if result.crawl && result.crawl.headings.length > 0}
                                        <div class="flex flex-col grow">
                                            <h4 class="text-sm font-medium mb-3 flex items-center gap-2">
                                                <FileText class="h-4 w-4" />
                                                Heading Structure ({result.crawl.headings.length})
                                            </h4>
                                            <div class="grow relative rounded-lg border p-3 space-y-1">
                                                <div class="absolute left-0 top-0 right-0 bottom-0 w-full h-full overflow-auto">
                                                    {#each result.crawl.headings as heading}
                                                        <div class="flex items-center gap-2" style="padding-left: {(heading.level - 1) * 16}px">
                                                            <Badge variant="outline" class="text-[10px] px-1.5 py-0 shrink-0">H{heading.level}</Badge>
                                                            <span class="text-sm truncate">{heading.text}</span>
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>
                                        </div>
                                    {/if}

                                    <!-- Images without alt -->
                                    {#if result.crawl && result.crawl.images.some(img => !img.hasAlt)}
                                        <div class="flex flex-col grow">
                                            <h4 class="text-sm font-medium mb-3 flex items-center gap-2">
                                                <Image class="h-4 w-4" />
                                                Images Missing Alt Text ({result.crawl.images.filter(img => !img.hasAlt).length})
                                            </h4>
                                            <div class="grow relative rounded-lg border p-3 space-y-1">
                                                <div class="absolute left-0 top-0 right-0 bottom-0 w-full h-full overflow-auto">
                                                    <table class="w-full text-xs">
                                                        <thead class="bg-muted sticky top-0">
                                                        <tr>
                                                            <th class="px-3 py-1.5 text-left font-medium">Source</th>
                                                        </tr>
                                                        </thead>
                                                        <tbody>
                                                        {#each result.crawl.images.filter(img => !img.hasAlt) as img}
                                                            <tr class="border-t">
                                                                <td class="px-3 py-1.5 font-mono truncate max-w-[500px]">{img.src}</td>
                                                            </tr>
                                                        {/each}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    {/if}
                                </div>


								<!-- AI Content Analysis -->
								{#if result.aiAnalysis}
									<div>
										<h4 class="text-sm font-medium mb-3 flex items-center gap-2">
											<Brain class="h-4 w-4" />
											AI Content Analysis
										</h4>
										<div class="grid gap-3 sm:grid-cols-3 mb-4">
											{#each [
												{ label: 'Content Quality', value: result.aiAnalysis.contentQuality },
												{ label: 'Readability', value: result.aiAnalysis.readability },
												{ label: 'Keyword Relevance', value: result.aiAnalysis.keywordRelevance }
											] as item}
												<div class="rounded-lg border p-3 text-center">
													<p class="text-xs text-muted-foreground">{item.label}</p>
													<p class="text-2xl font-bold {item.value >= 7 ? 'text-green-600' : item.value >= 4 ? 'text-yellow-600' : 'text-red-600'}">
														{item.value}<span class="text-sm font-normal text-muted-foreground">/10</span>
													</p>
												</div>
											{/each}
										</div>

										{#if result.aiAnalysis.summary}
											<p class="text-sm text-muted-foreground mb-3">{result.aiAnalysis.summary}</p>
										{/if}

										{#if result.aiAnalysis.recommendations.length > 0}
											<div class="space-y-2">
												<p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recommendations</p>
												{#each result.aiAnalysis.recommendations as rec}
													<div class="flex items-start gap-2 text-sm">
														<span class="text-green-600 shrink-0">&rarr;</span>
														<span>{rec}</span>
													</div>
												{/each}
											</div>
										{/if}
									</div>
								{/if}

								<!-- Issues -->
								{#if result.issues.length > 0}
									{@const issueKey = `issues-${i}`}
									<Collapsible.Root bind:open={openSections[issueKey]} class="rounded-lg border">
										<Collapsible.Trigger class="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
											<div class="flex items-center gap-2">
												{#if openSections[issueKey]}
													<ChevronDown class="h-4 w-4" />
												{:else}
													<ChevronRight class="h-4 w-4" />
												{/if}
												<AlertTriangle class="h-4 w-4" />
												<span class="text-sm font-medium">Issues</span>
												<Badge variant="secondary">{result.issues.length}</Badge>
											</div>
										</Collapsible.Trigger>
										<Collapsible.Content>
											<div class="space-y-2 px-4 pb-4">
												{#each result.issues as issue}
													<div class="flex items-start gap-3 rounded-lg border p-3">
														<svelte:component
															this={severityIcon(issue.severity)}
															class="h-4 w-4 shrink-0 mt-0.5 {severityColor(issue.severity)}"
														/>
														<div class="grid grid-cols-1 sm:grid-cols-4 flex-1 min-w-0">
															<div class="flex items-center gap-2 flex-wrap">
																<span class="text-sm font-medium">{issue.title}</span>
																<Badge variant={severityBadgeVariant(issue.severity)} class="text-[10px] px-1.5 py-0">
																	{issue.severity}
																</Badge>
																<Badge variant="outline" class="text-[10px] px-1.5 py-0">
																	{issue.category}
																</Badge>
															</div>
															<p class="text-sm text-muted-foreground mt-0.5">{issue.description}</p>
															<p class="col-span-2 text-sm text-green-700 dark:text-green-400 mt-1">&rarr; {issue.recommendation}</p>
														</div>
													</div>
												{/each}
											</div>
										</Collapsible.Content>
									</Collapsible.Root>
								{/if}
							{/if}
						</Tabs.Content>
					{/each}
				</Tabs.Root>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- URLs List (for non-completed or no-results audits) -->
	{#if audit.results.length === 0}
		<Card.Root>
			<Card.Header>
				<Card.Title>Audited URLs</Card.Title>
			</Card.Header>
			<Card.Content>
				<ul class="space-y-1">
					{#each audit.urls as url}
						<li class="flex items-center gap-2 text-sm">
							<Globe class="h-3 w-3 text-muted-foreground" />
							<a href={url} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-mono text-xs">
								{url}
							</a>
						</li>
					{/each}
				</ul>
			</Card.Content>
		</Card.Root>
	{/if}
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Audit</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete this audit? This will permanently remove all results, screenshots, and the PDF report.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={handleDelete}
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				disabled={isDeleting}
			>
				{#if isDeleting}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Delete
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
