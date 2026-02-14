# CRM Module

Pipeline-based lead management with Kanban drag-and-drop interface.

## Routes

| Route | Pattern | Purpose |
|-------|---------|---------|
| `/crm` | List + Kanban | Pipeline board with drag-and-drop |
| `/crm/new` | Full-page form | Create lead |
| `/crm/[id]` | Detail page | Lead details, notes, contact info |
| `/crm/[id]/edit` | Full-page form | Edit lead |

## API Endpoints

| Method | Route | Permission | Purpose |
|--------|-------|------------|---------|
| POST | `/api/leads` | `crm.create` | Create lead |
| GET | `/api/leads/[id]` | `crm.read` | Get single lead |
| PUT | `/api/leads/[id]` | `crm.update` | Update lead |
| DELETE | `/api/leads/[id]` | `crm.delete` | Delete lead (hard delete) |

## Lead Model

Key fields:
- `title` (String, required) — Lead name
- `description` (String?) — Markdown format
- `source` (String?) — Enum `lead_source`: referral, website, cold_call, event, social_media, partner, other
- `stage` (String) — Pipeline stage (see below)
- `order` (Int) — Position within stage column (Kanban ordering)
- `budget` (Decimal(10,2)?) — Estimated value
- `currency` (String, default "HUF")
- `estimatedHours` (Int?) — Duration in minutes
- `offerDueDate` (DateTime?) — When to deliver offer
- `deadline` (DateTime?) — Project completion deadline

Relations:
- `clientId` / `client` (Client?, onDelete: SetNull)
- `contactId` / `contact` (Contact?, onDelete: SetNull)
- `assignedToId` / `assignedTo` (User?, onDelete: SetNull)
- `createdById` / `createdBy` (User, onDelete: Restrict)

Denormalized: `clientName`, `contactName` — preserved when client/contact deleted.

Indexes: `stage`, `clientId`, `assignedToId`, `createdById`

## Pipeline Stages

Defined in `src/lib/config/lead-stages.ts`:

| Stage | Label | Description |
|-------|-------|-------------|
| `lead` | Lead | New lead, initial contact |
| `offer` | Offer | Offer sent to client |
| `approval` | Approval | Waiting for client approval |
| `won` | Won | Deal closed, won |
| `lost` | Lost | Deal lost |
| `postponed` | Postponed | Deal postponed |
| `archived` | Archived | Archived lead |

Exports: `LEAD_STAGES` (full array), `ACTIVE_STAGES` (lead, offer, approval), `STAGE_MAP` (quick lookup)

## Kanban Pipeline Board

- **7 columns** — one per stage, color-coded headers
- **Drag-and-drop** via `svelte-dnd-action` with 200ms flip animation
- **LeadCard** component displays: title, client name, budget, deadline, assignee avatar
- **Reorder action** (`?/reorderLeads`) — batch updates changed leads, single audit entry
- Click card to navigate to detail page (prevented during drag)

## Components

### LeadCard (`src/lib/components/shared/LeadCard.svelte`)
- Compact card with left border matching stage color
- Props: `lead`, `stageColor`, optional `onclick`
- Displays budget (currency icon), deadline (calendar icon), assignee (UserAvatar)

## Form Handling

- **Create/Edit**: Full-page forms with Superforms + Zod validation
- **Sections**: Basic Info (title, source, assigned employee), Client & Contact (cascading select), Financial & Timeline (budget, currency, estimated time, dates)
- Client→Contact cascade: contacts filtered by selected client

## Enums

| Code | Module | Values |
|------|--------|--------|
| `lead_source` | CRM | referral (default), website, cold_call, event, social_media, partner, other |

## Permissions

Module: `crm` — Actions: `read`, `create`, `update`, `delete`
