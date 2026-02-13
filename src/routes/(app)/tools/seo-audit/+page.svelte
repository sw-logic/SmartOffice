<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Select from '$lib/components/ui/select';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import {
		Search,
		Play,
		Download,
		Trash2,
		Loader2,
		AlertTriangle,
		CheckCircle2,
		Clock,
		XCircle,
		Globe,
		Eye,
		Languages
	} from 'lucide-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/date';

	let { data } = $props();

	// Language options
	const LANGUAGES = [
		{ value: 'en', label: 'English' },
		{ value: 'hu', label: 'Magyar' },
		{ value: 'de', label: 'Deutsch' },
		{ value: 'fr', label: 'Français' },
		{ value: 'es', label: 'Español' },
		{ value: 'it', label: 'Italiano' },
		{ value: 'pt', label: 'Português' },
		{ value: 'nl', label: 'Nederlands' },
		{ value: 'pl', label: 'Polski' },
		{ value: 'cs', label: 'Čeština' },
		{ value: 'sk', label: 'Slovenčina' },
		{ value: 'ro', label: 'Română' },
		{ value: 'hr', label: 'Hrvatski' },
		{ value: 'sr', label: 'Srpski' },
		{ value: 'bg', label: 'Български' },
		{ value: 'ru', label: 'Русский' },
		{ value: 'uk', label: 'Українська' },
		{ value: 'ja', label: '日本語' },
		{ value: 'zh', label: '中文' },
		{ value: 'ko', label: '한국어' }
	];

	// URL input state
	let urlInput = $state('');
	let selectedLanguage = $state('en');
	let isStarting = $state(false);
	let validationErrors = $state<string[]>([]);

	// Polling state
	let pollingAuditId = $state<number | null>(data.runningAuditId);
	let pollingInterval: ReturnType<typeof setInterval> | null = null;
	let pollingData = $state<{
		status: string;
		progress: { currentUrl: string; currentStep: string; completedUrls: number; totalUrls: number } | null;
		error: string | null;
	} | null>(null);

	// Delete state
	let deleteDialogOpen = $state(false);
	let deleteTargetId = $state<number | null>(null);
	let isDeleting = $state(false);

	// URL count
	let urlCount = $derived(
		urlInput.split(/[\n\r]+/).filter(l => l.trim().length > 0).length
	);

	// Start polling on page load if there's a running audit
	$effect(() => {
		if (data.runningAuditId && !pollingInterval) {
			pollingAuditId = data.runningAuditId;
			startPolling(data.runningAuditId);
		}
		return () => {
			if (pollingInterval) {
				clearInterval(pollingInterval);
				pollingInterval = null;
			}
		};
	});

	function startPolling(auditId: number) {
		if (pollingInterval) clearInterval(pollingInterval);

		pollingInterval = setInterval(async () => {
			try {
				const res = await fetch(`/api/tools/seo-audit/${auditId}`);
				if (!res.ok) {
					stopPolling();
					return;
				}
				const audit = await res.json();
				pollingData = {
					status: audit.status,
					progress: audit.progress,
					error: audit.error
				};

				if (audit.status === 'completed') {
					stopPolling();
					toast.success('SEO audit completed!');
					await invalidateAll();
				} else if (audit.status === 'failed') {
					stopPolling();
					toast.error(`SEO audit failed: ${audit.error || 'Unknown error'}`);
					await invalidateAll();
				}
			} catch {
				stopPolling();
			}
		}, 2500);
	}

	function stopPolling() {
		if (pollingInterval) {
			clearInterval(pollingInterval);
			pollingInterval = null;
		}
		pollingAuditId = null;
		pollingData = null;
	}

	async function handleStartAudit() {
		if (!urlInput.trim()) {
			validationErrors = ['Please enter at least one URL'];
			return;
		}

		isStarting = true;
		validationErrors = [];

		try {
			const res = await fetch('/api/tools/seo-audit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ urls: urlInput, language: selectedLanguage })
			});

			const result = await res.json();

			if (!res.ok || !result.success) {
				validationErrors = result.errors || ['Failed to start audit'];
				if (result.warnings?.length) {
					result.warnings.forEach((w: string) => toast.info(w));
				}
				return;
			}

			if (result.warnings?.length) {
				result.warnings.forEach((w: string) => toast.info(w));
			}

			toast.success('SEO audit started!');
			urlInput = '';
			pollingAuditId = result.audit.id;
			startPolling(result.audit.id);
			await invalidateAll();
		} catch (err) {
			validationErrors = ['Network error. Please try again.'];
		} finally {
			isStarting = false;
		}
	}

	async function handleDelete() {
		if (!deleteTargetId) return;
		isDeleting = true;

		try {
			const res = await fetch(`/api/tools/seo-audit/${deleteTargetId}`, { method: 'DELETE' });
			if (res.ok) {
				toast.success('Audit deleted');
				await invalidateAll();
			} else {
				const data = await res.json().catch(() => ({}));
				toast.error(data.message || 'Failed to delete audit');
			}
		} catch {
			toast.error('Network error');
		} finally {
			isDeleting = false;
			deleteDialogOpen = false;
			deleteTargetId = null;
		}
	}

	function getStatusBadge(status: string): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string } {
		switch (status) {
			case 'pending': return { variant: 'secondary', label: 'Pending' };
			case 'running': return { variant: 'default', label: 'Running' };
			case 'completed': return { variant: 'outline', label: 'Completed' };
			case 'failed': return { variant: 'destructive', label: 'Failed' };
			default: return { variant: 'secondary', label: status };
		}
	}

	function formatDuration(startedAt: string | null, completedAt: string | null): string {
		if (!startedAt || !completedAt) return '-';
		const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
		if (ms < 60000) return `${Math.round(ms / 1000)}s`;
		return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
	}
</script>

<svelte:head>
	<title>SEO Audit - SmartOffice</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex items-center gap-3">
		<Search class="h-7 w-7 text-muted-foreground" />
		<div>
			<h1 class="text-2xl font-bold">SEO Audit</h1>
			<p class="text-muted-foreground text-sm">Audit web pages for SEO issues, performance, and content quality</p>
		</div>
	</div>

	<!-- URL Input Form -->
	{#if data.canCreate}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Globe class="h-5 w-5" />
					New Audit
				</Card.Title>
				<Card.Description>Enter URLs to audit (one per line) and select the report language</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<Label for="urls">URLs</Label>
						<span class="text-xs text-muted-foreground">{urlCount} URL{urlCount !== 1 ? 's' : ''}</span>
					</div>
					<Textarea
						id="urls"
						bind:value={urlInput}
						placeholder={"https://example.com\nhttps://example.com/about\nhttps://example.com/contact"}
						rows={5}
						class="font-mono text-sm"
						disabled={isStarting || !!pollingAuditId}
					/>
				</div>

				<div class="space-y-2">
					<Label>
						<span class="flex items-center gap-1.5">
							<Languages class="h-4 w-4" />
							Report Language
						</span>
					</Label>
					<Select.Root
						type="single"
						value={selectedLanguage}
						onValueChange={(v) => { if (v) selectedLanguage = v; }}
						disabled={isStarting || !!pollingAuditId}
					>
						<Select.Trigger class="w-[200px]">
							{LANGUAGES.find(l => l.value === selectedLanguage)?.label || 'English'}
						</Select.Trigger>
						<Select.Content>
							{#each LANGUAGES as lang}
								<Select.Item value={lang.value}>{lang.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<p class="text-xs text-muted-foreground">AI summaries and recommendations will be written in this language</p>
				</div>

				{#if validationErrors.length > 0}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{#each validationErrors as error}
							<p class="flex items-center gap-2">
								<AlertTriangle class="h-4 w-4 shrink-0" />
								{error}
							</p>
						{/each}
					</div>
				{/if}

				<Button
					onclick={handleStartAudit}
					disabled={isStarting || !!pollingAuditId || urlCount === 0}
				>
					{#if isStarting}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Starting...
					{:else}
						<Play class="mr-2 h-4 w-4" />
						Start Audit
					{/if}
				</Button>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Active Audit Progress -->
	{#if pollingAuditId && pollingData}
		<Card.Root class="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Loader2 class="h-5 w-5 animate-spin text-blue-600" />
					Audit in Progress
				</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#if pollingData.progress}
					<!-- Progress bar -->
					<div class="w-full rounded-full bg-gray-200 dark:bg-gray-700">
						<div
							class="h-3 rounded-full bg-blue-600 transition-all duration-500"
							style="width: {pollingData.progress.totalUrls > 0
								? (pollingData.progress.completedUrls / pollingData.progress.totalUrls) * 100
								: 0}%"
						></div>
					</div>
					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">
							{pollingData.progress.completedUrls} / {pollingData.progress.totalUrls} URLs
						</span>
						<span class="font-medium text-blue-600">
							{pollingData.progress.currentStep}
						</span>
					</div>
					{#if pollingData.progress.currentUrl}
						<p class="truncate text-xs text-muted-foreground font-mono">
							{pollingData.progress.currentUrl}
						</p>
					{/if}
				{:else}
					<p class="text-sm text-muted-foreground">Initializing...</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Audit History -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Clock class="h-5 w-5" />
				Audit History
			</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if data.audits.length === 0}
				<p class="py-8 text-center text-muted-foreground">
					No audits yet. Enter URLs above to start your first audit.
				</p>
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Date</Table.Head>
							<Table.Head>URL</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head>Score</Table.Head>
							<Table.Head>Issues</Table.Head>
							<Table.Head>Duration</Table.Head>
							<Table.Head class="w-[100px]">Actions</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.audits as audit}
							{@const statusBadge = getStatusBadge(audit.status)}
							<Table.Row class="cursor-pointer" onclick={() => goto(`/tools/seo-audit/${audit.id}`)}>
								<Table.Cell class="whitespace-nowrap">
									{formatDate(audit.createdAt)}
								</Table.Cell>
								<Table.Cell class="max-w-[300px]">
									<p class="truncate font-mono text-xs">{audit.urls[0]}</p>
									{#if audit.urls.length > 1}
										<span class="text-muted-foreground text-xs">+{audit.urls.length - 1} more</span>
									{/if}
								</Table.Cell>
								<Table.Cell>
									<Badge variant={statusBadge.variant} class={audit.status === 'running' ? 'animate-pulse' : ''}>
										{statusBadge.label}
									</Badge>
								</Table.Cell>
								<Table.Cell>
									{#if audit.summary?.overallScore != null}
										{@const score = audit.summary.overallScore}
										<span class="font-bold {score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'}">
											{score}
										</span>
									{:else}
										<span class="text-muted-foreground">-</span>
									{/if}
								</Table.Cell>
								<Table.Cell>
									{#if audit.summary?.totalIssues}
										{@const issues = audit.summary.totalIssues}
										<div class="flex items-center gap-2 text-xs">
											{#if issues.critical > 0}
												<span class="text-red-600 font-medium">{issues.critical}C</span>
											{/if}
											{#if issues.warning > 0}
												<span class="text-yellow-600 font-medium">{issues.warning}W</span>
											{/if}
											{#if issues.info > 0}
												<span class="text-blue-600">{issues.info}I</span>
											{/if}
										</div>
									{:else}
										<span class="text-muted-foreground">-</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="text-sm text-muted-foreground">
									{formatDuration(audit.startedAt, audit.completedAt)}
								</Table.Cell>
								<Table.Cell>
									<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
										{#if audit.status === 'completed'}
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8"
												onclick={() => goto(`/tools/seo-audit/${audit.id}`)}
												title="View Details"
											>
												<Eye class="h-4 w-4" />
											</Button>
										{/if}
										{#if audit.status === 'completed' && audit.pdfPath}
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8"
												onclick={() => {
													window.open(`/api/tools/seo-audit/${audit.id}/pdf`, '_blank');
												}}
												title="Download PDF Report"
											>
												<Download class="h-4 w-4" />
											</Button>
										{/if}
										{#if data.canDelete && audit.status !== 'running'}
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8 text-destructive"
												onclick={() => {
													deleteTargetId = audit.id;
													deleteDialogOpen = true;
												}}
												title="Delete Audit"
											>
												<Trash2 class="h-4 w-4" />
											</Button>
										{/if}
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Audit</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete this audit? This will permanently remove the audit results and PDF report.
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
