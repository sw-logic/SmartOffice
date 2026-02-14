# SEO Audit Tool

Comprehensive website SEO analysis with Playwright crawling, Lighthouse metrics, AI-powered content analysis, and PDF report generation.

## Routes

| Route | Pattern | Purpose |
|-------|---------|---------|
| `/tools/seo-audit` | List + form | URL input, language selector, audit history, real-time progress |
| `/tools/seo-audit/[id]` | Detail page | Per-URL results, scores, issues, screenshots, AI summary |

## API Endpoints

| Method | Route | Permission | Purpose |
|--------|-------|------------|---------|
| POST | `/api/tools/seo-audit` | `tools.create` | Start new audit (fire-and-forget) |
| GET | `/api/tools/seo-audit/[id]` | `tools.read` | Get audit status + results (polling) |
| DELETE | `/api/tools/seo-audit/[id]` | `tools.delete` | Delete audit + PDF |
| GET | `/api/tools/seo-audit/[id]/pdf` | `tools.read` | Download PDF report |

## SeoAudit Model

Key fields:
- `status` (String, default "pending") — pending, running, completed, failed
- `language` (String, default "en") — 20 supported languages
- `urls` (Json) — String[] input URLs
- `progress` (Json?) — `{ currentUrl, currentStep, completedUrls, totalUrls }`
- `results` (Json?) — Per-URL findings array
- `summary` (Json?) — Overall scores + AI recommendations
- `pdfPath` (String?) — Relative path to generated PDF
- `error` (Text?) — Failure message
- `startedAt`, `completedAt`, `createdAt`, `updatedAt`

Relations:
- `createdById` / `createdBy` (User)

Indexes: `createdById`, `status`, `createdAt`

## Server Library (`src/lib/server/seo/`)

### runner.ts — Main Orchestration
- `runSeoAudit(auditId, userId)` — Fire-and-forget pipeline
- `cleanupStaleAudits()` — Mark stuck audits as failed (>10min in "running")
- Processes each URL sequentially: crawl → analyze → lighthouse → AI analysis
- Generates charts and PDF report
- Per-URL timeout: 120s (configurable via `SEO_AUDIT_TIMEOUT` env)

### crawler.ts — Playwright Page Scraping
- `crawlUrl(url, auditId, urlIndex)` — Navigates with 30s timeout
- Uses shared `getBrowser()` / `closeBrowser()` from `$lib/server/screenshot`
- Captures desktop (1920x1080) and mobile (375x812) screenshots
- Extracts: title, meta description, meta keywords, canonical URL, OG tags, headings (h1-h6), images (with alt check), links (internal/external), word count, robots meta, viewport meta, structured data (JSON-LD)
- HTML content capped at 100KB

### analyzer.ts — SEO Issue Detection
- `analyzeCrawlResult(crawl)` — HTML-based rule checks
- Categories: meta, content, performance, accessibility, technical, mobile
- Severities: critical, warning, info
- Checks: title length (30-60 chars), meta description (120-160 chars), single H1, image alt text, robots.txt, sitemap.xml, canonical URL, structured data, viewport meta

### lighthouse-runner.ts — Google Lighthouse
- Performance, accessibility, bestPractices, seo scores
- Core Web Vitals: LCP, FID, CLS, FCP, TTFB

### ai-analyzer.ts — Claude AI Integration
- `analyzePageContent(crawl, language)` — Content quality (1-10), readability (1-10), keyword relevance (1-10)
- `generateExecutiveSummary(results, issues, language)` — AI-generated markdown report
- `translateIssues(issues, language)` — Batch translate findings

### url-validator.ts — SSRF Protection
- Max 20 URLs per audit (configurable: `SEO_AUDIT_MAX_URLS`)
- Blocks private IPs (127.x, 10.x, 172.16-31.x, 192.168.x), localhost
- DNS validation (no rebinding attacks)
- Deduplication, auto-prepends `https://`, max URL length 2048

### chart-generator.ts — Chart Generation
- `generateScoresRadarChart(lighthouseScores)` — Radar chart
- `generateIssuesBreakdownChart(issues)` — Bar chart by severity
- `generateCategoryScoresBarChart(categoryScores)` — Category comparison

### pdf-generator.ts — PDF Report
- `generatePdfReport(auditId, urls, results, summary, charts)` — Full PDF with charts, findings, executive summary

## Frontend Features

### List/Dashboard Page
- URL input textarea (one per line, max 20)
- Language selector (20 languages: en, hu, de, fr, es, it, pt, nl, pl, cs, sk, ro, hr, sr, bg, ru, uk, ja, zh, ko)
- Active audit progress bar with 2.5s polling intervals
- Audit history table: date, URL, status badge, score (color-coded: green 80+, yellow 50-79, red <50), issue counts, duration, actions (view, PDF, delete)
- Max 1 concurrent audit per user

### Detail Page
- Header: overall score, summary metrics
- Category scores card (technical, content, performance, accessibility)
- Top issues list with severity badges
- Per-URL tabs:
  - Crawl results (title, meta, headings, images, links)
  - Issue breakdown table
  - Lighthouse scores
  - Core Web Vitals
  - AI analysis (quality, readability, recommendations)
  - Desktop/mobile screenshots
- AI executive summary (markdown)
- PDF download button

## Supported Languages

en, hu, de, fr, es, it, pt, nl, pl, cs, sk, ro, hr, sr, bg, ru, uk, ja, zh, ko

## Permissions

Module: `tools` — Actions: `read`, `create`, `delete`
