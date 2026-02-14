# Services Module

Monthly recurring services with time tracking, budget management, and automatic income generation.

## Routes

| Route | Pattern | Purpose |
|-------|---------|---------|
| `/services` | List page | Services list with search, sort, pagination, status filter |
| `/services/new` | Full-page form | Create service |
| `/services/[id]` | Detail page | Service details with tabs: Overview, Time Records, Notes |
| `/services/[id]/edit` | Full-page form | Edit service (with income sync logic) |
| `/services/hosting` | Card grid | WordPress hosting site monitoring |
| `/services/hosting/[id]` | Detail page | Hosting site with sync tabs |

## API Endpoints

### Service Time Records

| Method | Route | Permission | Purpose |
|--------|-------|------------|---------|
| POST | `/api/services/[id]/time-records` | `services.update` | Create time record |
| PATCH | `/api/services/[id]/time-records/[recordId]` | `services.update` | Update time record |
| DELETE | `/api/services/[id]/time-records/[recordId]` | `services.update` | Delete time record |

### Hosting Sites

| Method | Route | Permission | Purpose |
|--------|-------|------------|---------|
| POST | `/api/hosting` | `services.create` | Create hosting site |
| GET | `/api/hosting/[id]` | `services.read` | Get hosting site |
| PUT | `/api/hosting/[id]` | `services.update` | Update hosting site |
| DELETE | `/api/hosting/[id]` | `services.delete` | Delete hosting site |
| POST | `/api/hosting/[id]/sync` | `services.read` | Sync status from WordPress |
| POST | `/api/hosting/[id]/sync?endpoint=plugins\|themes\|core\|health` | `services.read` | Fetch detailed data |
| POST | `/api/hosting/[id]/login` | `services.update` | Get one-time WP admin login URL |

## Service Model

Key fields:
- `name` (String) — Service name
- `description` (Text?) — Markdown format (SLA/scope)
- `type` (String?) — Enum `service_type`
- `status` (String, default "active") — Enum `service_status`
- `monthlyFee` (Decimal(10,2)) — Recurring fee
- `currency` (String, default "HUF")
- `recurringPeriod` (String, default "monthly")
- `taxRate` (Decimal(5,2)) — Tax percentage
- `budgetedHours` (Int?) — Monthly budget in minutes
- `spentTime` (Int, default 0) — Materialized aggregate from TimeRecords
- `startDate` (DateTime), `endDate` (DateTime?)

Relations:
- `clientId` / `client` (Client?, onDelete: SetNull)
- `contactId` / `contact` (Contact?, onDelete: SetNull)
- `assignedToId` / `assignedTo` (User?, onDelete: SetNull)
- `createdById` / `createdBy` (User)
- `incomeId` / `income` (Income?, unique, onDelete: SetNull) — Auto-generated recurring income parent
- `timeRecords` (TimeRecord[]) — Time tracking
- `hostingSites` (HostingSite[]) — Linked WordPress sites

Denormalized: `clientName`, `contactName` — preserved when client/contact deleted.

## HostingSite Model

Key fields:
- `name` (String) — Display name
- `domain` (String) — e.g. "clientx.com"
- `apiUrl` (String) — e.g. `https://clientx.com/wp-json/smartoffice/v1`
- `apiKey` (String) — SmartOffice Connector plugin API key
- `status` (String, default "unknown") — "good", "should_improve", "critical", "offline", "unknown"
- `thumbnailPath` (String?) — Desktop screenshot relative path (e.g. `hosting/thumbnails/123.png`)
- Cached fields: `wpVersion`, `phpVersion`, `coreUpdate`, `pluginUpdates`, `themeUpdates`, `totalUpdates`, `activePlugins`
- `lastSyncData` (Json?), `lastSyncAt`, `lastSyncError`

Relations:
- `serviceId` / `service` (Service?, onDelete: SetNull)
- `clientId` / `client` (Client?, onDelete: SetNull)
- `createdById` / `createdBy` (User)

Denormalized: `clientName`

## Key Flows

### Service Creation with Income Generation
1. User fills form (name, client, start date, optional fee)
2. Service created with denormalized client/contact names
3. If `monthlyFee > 0`, auto-generate recurring Income parent via `generateServiceIncome()` in `recurring.ts`
4. Income linked back via `service.incomeId`
5. Audit logged, redirect to detail page

### Service Edit — Fee Changes
- **Fee removed** → Delete linked income parent (cascade deletes projected children)
- **Fee added** → Create new recurring Income parent
- **Fee/dates changed** → Update income parent amount/tax, regenerate projected children

### Service Time Tracking
1. Add time via `ServiceTimeRecordFormModal` → `POST /api/services/[id]/time-records`
2. `recalcServiceSpentTime(serviceId)` aggregates SUM(minutes) → updates `service.spentTime`
3. Budget progress shown as bar in detail page overview

### Hosting Site Sync
1. `POST /api/hosting/[id]/sync` → fetches `{apiUrl}/overview` with `X-SmartOffice-Key` header
2. Updates cached fields (status, versions, update counts, lastSyncAt)
3. Non-blocking: captures desktop screenshot via Playwright (`captureScreenshot()`) → updates `thumbnailPath`
4. Error: sets `lastSyncError`, `status: 'offline'`

### WordPress Auto-Login
1. `POST /api/hosting/[id]/login` → calls `{apiUrl}/auth/token` with requester name
2. WordPress plugin generates one-time token (64 hex chars, 30s TTL)
3. Returns `loginUrl` → client opens in new tab
4. WordPress validates token, sets auth cookie, redirects to admin

## Components

### ServiceTimeRecordsList (`src/lib/components/shared/ServiceTimeRecordsList.svelte`)
- Table of time records (Date, Time, Detail, Type, Billable)
- Total spent time summary, "Add Time" button
- Edit/delete via embedded `ServiceTimeRecordFormModal`

### ServiceTimeRecordFormModal (`src/lib/components/shared/ServiceTimeRecordFormModal.svelte`)
- Date picker, `DurationInput`, `TextareaWithVoice` (description), type/category selects, person select, billable checkbox

### HostingSiteFormModal (`src/lib/components/shared/HostingSiteFormModal.svelte`)
- Name, domain (auto-fills API URL), API URL, API key (password field), client select, service select
- Auto-fill pattern: `https://{domain}/wp-json/smartoffice/v1`

## Screenshot Utility (`src/lib/server/screenshot.ts`)

Shared Playwright browser management (also used by SEO audit):
- `getBrowser()` — Reuses or launches headless Chromium
- `closeBrowser()` — Closes browser connection
- `captureScreenshot(url, absolutePath, relativePath)` — 1920x1080 viewport, `networkidle` wait, returns relative path or null

Thumbnails saved to: `{UPLOAD_DIR}/hosting/thumbnails/{siteId}.png`
Served via: `/api/uploads/{thumbnailPath}` (static file route)

## WordPress Plugin (`wordpress-plugin/smartoffice-connector/`)

PHP plugin (WP 5.6+, PHP 7.4+) providing the REST API that SmartOffice connects to.

### Plugin Settings (Settings > SmartOffice)
- API Key (48 random chars, auto-generated on activation)
- Admin user for auto-login
- Token expiry (10-120 seconds, default 30)
- IP binding (optional whitelist)
- Recent login log (last 50 attempts)

### Plugin REST Endpoints (`/wp-json/smartoffice/v1/`)

All require `X-SmartOffice-Key` header. Optional IP whitelist check.

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/overview` | GET | Quick status summary (no health tests) |
| `/plugins` | GET | Plugin list with versions, active status, update availability |
| `/themes` | GET | Theme list with versions, active status, update availability |
| `/core` | GET | WP/PHP/MySQL versions, storage sizes, user count |
| `/health` | GET | Site Health score, passed/recommended/critical counts, issues |
| `/auth/token` | POST | One-time login URL (token + transient with TTL) |

### Status Logic (`/overview`)
- `critical`: core update OR >3 total updates
- `should_improve`: 1-3 updates
- `good`: no updates

### Auto-Login Flow
1. Token generated: 64 hex chars stored as WP transient
2. Login via `?smartoffice_login={token}` query param
3. Validates: token format → transient exists → IP binding → user exists + has admin cap
4. Sets auth cookie → redirects to admin dashboard
5. Token deleted immediately (one-time use)

## Enums

| Code | Module | Purpose |
|------|--------|---------|
| `service_type` | Services | Service type classification |
| `service_status` | Services | Service status (active, suspended, etc.) |

## Permissions

Module: `services` — Actions: `read`, `create`, `update`, `delete`
