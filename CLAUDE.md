# SmartOffice - Development Blueprint

## Project Overview

A web-based company management system for managing clients, employees, vendors, projects, finances (
income/expenses/payments), price lists, and offers. Single-company deployment with role-based access control and audit
logging.

### Target Users

- Company administrators
- Managers
- Employees
- Accountants/Financial staff

---

## Technical Stack

### Core

- **Framework**: SvelteKit with Svelte 5
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL 16 with Prisma 7 ORM (`@prisma/adapter-pg` with pg Pool)
- **Auth**: Auth.js with Credentials provider
- **UI**: shadcn-svelte + TailwindCSS + lucide-svelte
- **Forms**: Superforms with Zod validation (full-page forms), fetch-based API calls (modals)
- **Notifications**: svelte-sonner
- **Markdown**: carta-md (editor) + DOMPurify (sanitization)

### Additional Libraries

- **date-fns** - Date manipulation
- **jsPDF / @pdfme** - PDF generation
- **xlsx (SheetJS)** - Excel import/export
- **Nodemailer** - Email sending
- **svelte-dnd-action** - Drag-and-drop for kanban boards
- **tailwind-variants** (tv) - Component variant styling (used in shadcn-svelte Button, etc.)

### Infrastructure

- Own server deployment with Nginx reverse proxy
- PM2 or systemd for process management
- GitHub for version control

---

## Architecture

### Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/           # shadcn-svelte components (Button, Input, Select, etc.)
│   │   ├── layout/       # AppShell, Sidebar, Header
│   │   └── shared/       # IncomeFormModal, ExpenseFormModal, NotesList, TaskCard,
│   │                     # MarkdownEditor, MarkdownViewer, ColorInput, DurationInput,
│   │                     # TaskDetailModal, TaskTimeRecordsList, TimeRecordFormModal,
│   │                     # NoteFormModal, DateRangeSelector
│   ├── server/
│   │   ├── prisma.ts     # Prisma client singleton
│   │   ├── access-control.ts  # RBAC: requirePermission, checkPermission, isAdmin
│   │   ├── audit.ts      # logCreate, logUpdate, logDelete, logAction, logLogin
│   │   ├── enums.ts      # Enum management with caching (ALL_ENUM_CODES)
│   │   ├── email.ts      # Nodemailer integration
│   │   ├── file-upload.ts # Secure file upload with category-based paths
│   │   ├── rate-limit.ts  # Sliding-window rate limiter (login, API mutations, reads)
│   │   ├── recurring.ts   # Recurring income/expense generation and promotion
│   │   ├── time-records.ts # recalcTaskSpentTime, formatMinutes
│   │   └── user-cache.ts  # TTL-based user validity cache (5 min)
│   ├── stores/
│   └── utils/
│       └── date.ts       # formatDate utility
├── routes/
│   ├── (auth)/           # Public auth routes (login)
│   ├── (app)/            # Protected app routes
│   │   ├── clients/
│   │   ├── vendors/
│   │   ├── employees/
│   │   ├── projects/     # projects, boards, tasks
│   │   ├── finances/     # dashboard, income, expenses
│   │   ├── pricelists/
│   │   └── settings/     # users, groups, enums
│   └── api/              # REST endpoints for modal-based CRUD
│       ├── income/       # POST, GET/PUT/DELETE [id]
│       ├── expenses/     # POST, GET/PUT/DELETE [id]
│       ├── notes/        # POST, GET/PATCH/DELETE [id]
│       └── tasks/        # POST, GET/PUT/DELETE [id], time-records, modal-data
├── styles/
│   ├── app.scss          # Global styles
│   └── _carta-markdown-editor.scss  # Markdown editor theme
└── hooks.server.ts       # Auth middleware + permission pre-loading
```

---

## Core Patterns

### Svelte 5 Runes

We use Svelte 5 runes throughout the application:

- `$state()` for reactive state
- `$props()` for component props
- `$derived()` for computed values
- `$effect()` for side effects

### Authentication & Authorization

- All `(app)` routes require authentication via `hooks.server.ts`
- Permissions are module + action based: `module.action` (e.g., `clients.read`, `finances.income.delete`)
- Users belong to UserGroups which have Permissions
- Wildcard support: `*.*` (global admin), `module.*` (module admin)
- Use `requirePermission(locals, module, action)` in every server action (throws redirect if missing)
- Use `checkPermission(locals, module, action)` for conditional UI (returns boolean)
- Use `isAdmin(locals)` to check for `*.*` wildcard
- Row-level: `canAccessProject(locals, projectId)`, `isProjectManager(locals, projectId)`
- Permission modules: `clients`, `vendors`, `employees`, `projects`, `finances.income`, `finances.expenses`, `settings`, `*`

### Hard Delete + Audit Log

- All deletions are **hard deletes** (`prisma.X.delete()`) — no soft-delete, no `deletedAt` columns
- **Always call `logDelete()` BEFORE `prisma.X.delete()`** — the record won't exist after deletion
- The `AuditLog` table with `oldValues` JSON snapshot preserves full history for compliance
- Nullable FK relations use `onDelete: SetNull` to prevent constraint errors (e.g., deleting a client sets `Income.clientId = null`)
- Self-referential recurring records use `onDelete: Cascade` (deleting parent cascades to projected children)
- `ProjectEmployee`, `KanbanBoardMember` join tables use `onDelete: Cascade`

### Denormalized Names (Financial Records)

- `Income.clientName` and `Expense.vendorName` preserve the entity name when the linked client/vendor is deleted
- Populated on create and update (API handlers and full-page forms)
- Copied from parent in recurring occurrence generation (`recurring.ts`)
- Display pattern: `entity.client?.name || entity.clientName || '-'` (prefer live relation, fall back to denormalized)

### Audit Logging

- Log all important actions: create, update, delete, login, logout, export
- AuditAction types: `created`, `updated`, `deleted`, `exported`, `login`, `logout`, `login_failed`, `password_changed`, `permission_changed`
- Convenience functions: `logCreate()`, `logUpdate()`, `logDelete()`, `logLogin()`, `logLogout()`, `logExport()`
- Generic: `logAction({ userId, action, module, entityId, entityType, oldValues, newValues })`
- Query helpers: `getEntityAuditLogs(module, entityId)`, `getUserAuditLogs(userId)`
- Error handling: Logs to console but doesn't throw (non-blocking)

### Enum Management

- Dynamic enums stored in `EnumType` and `EnumValue` tables
- Grouped by module: Generic, Finances, Clients, Vendors, Employees, Projects, Offers, Price Lists
- 26 registered enum codes in `ALL_ENUM_CODES` (see full list below)
- Functions: `getEnumValues(typeCode)`, `getEnumValuesBatch(typeCodes)`, `clearEnumCache()`, `getEnumDefaultValue()`, `getEnumLabel()`
- 5-minute cache TTL for performance
- `EnumOption` type: `{ value, label, description?, isDefault, color?, metadata? }`
- All enums loaded in app layout (`+layout.server.ts`) and available as `data.enums.{code}`
- Manage via Settings > Enums admin UI

#### ALL_ENUM_CODES

```
Generic:    currency, priority, entity_status, note_priority
Finances:   income_category, income_status, expense_category, expense_status,
            payment_method, payment_status, payment_terms, recurring_period
Clients:    client_industry
Vendors:    vendor_category
Employees:  department, employment_type, employee_status
Projects:   project_status, task_status, task_type, task_category
Time:       time_record_type, time_record_category
Other:      offer_status, unit_of_measure, pricelist_category
```

### Rate Limiting

- `RateLimiter` class with sliding-window algorithm in `rate-limit.ts`
- Pre-configured instances: `loginLimiter` (5/60s), `apiMutationLimiter` (100/60s), `apiReadLimiter` (200/60s)
- Method: `check(key)` returns `{ allowed, remaining, retryAfterSeconds }`
- Auto-sweep every 60s to prevent memory leaks

### User Cache

- `user-cache.ts` with 5-minute TTL
- Functions: `getCachedUserValidity(userId)`, `setCachedUserValidity(userId, valid)`, `invalidateUserValidity(userId)`
- Avoids DB query on every request to verify user exists

### File Upload

- Secure upload with `saveFile(file, category, allowedTypes?)` in `file-upload.ts`
- Categories: `receipts`, `documents`, `offers`, `avatars`, `logos`
- Directory structure: `/uploads/{category}/{year}/{month}/{uuid}{ext}`
- Security: `resolveSecurePath()` validates against directory traversal
- Allowed types: images (jpeg, png, gif, webp), documents (pdf, doc, docx), spreadsheets (xls, xlsx, csv)
- Max size: 10MB default (configurable via `MAX_FILE_SIZE` env var)

---

## List View Pattern

Standard features for all list pages:

- **Search**: Input with Enter to search
- **Sorting**: Clickable column headers with asc/desc toggle
- **Pagination**: Page navigation with item count
- **Clickable Rows**: Click row to navigate to detail view (where applicable)
- **Actions**: View, Edit, Delete (permanent)
- **Confirmation Dialogs**: AlertDialog for destructive actions
- **Toast Notifications**: Success/error feedback via `svelte-sonner`
- **Checkbox Selection**: Bulk delete support with select-all/individual checkboxes
- **Event Bubbling Prevention**: `onclick={(e) => e.stopPropagation()}` on action cells in clickable rows

### Event Bubbling Prevention Pattern

For list pages with clickable rows (`<Table.Row onclick={() => goto(...)}>"`), action buttons and checkboxes must prevent event propagation to avoid triggering navigation:

```svelte
<Table.Cell onclick={(e) => e.stopPropagation()}>
    <Checkbox ... />
</Table.Cell>
<!-- ... other cells ... -->
<Table.Cell>
    <div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" ...>
    </div>
</Table.Cell>
```

Applied on: employees, clients, vendors, projects list pages. Not needed on income/expenses (no clickable rows).

### Checkbox Selection / Bulk Delete Pattern

Implemented on: employees, tasks, income, expenses list pages.

**State variables:**
```typescript
let selectedIds = $state<Set<number>>(new Set());
let bulkDeleteDialogOpen = $state(false);
let isBulkDeleting = $state(false);
```

**Derived values:**
```typescript
let allSelected = $derived(data.items.length > 0 && selectedIds.size === data.items.length);
let someSelected = $derived(selectedIds.size > 0 && selectedIds.size < data.items.length);
```

**Functions:**
- `toggleSelectAll()` — selects or deselects all visible items
- `toggleSelect(id)` — toggles a single item (creates new Set for reactivity)
- `handleBulkDelete()` — async fetch to `?/bulkDelete` with comma-separated IDs

**Server action pattern:**
```typescript
bulkDelete: async ({ locals, request }) => {
    await requirePermission(locals, 'module', 'delete');
    const idsStr = formData.get('ids') as string;
    const ids = idsStr.split(',').map(Number).filter(id => !isNaN(id));
    // ... find records, audit log each, then deleteMany
    return { success: true, count: items.length };
}
```

**UI pattern:**
- Checkbox column in table header (select-all with indeterminate state) and each row
- Bulk delete button appears in header when `selectedIds.size > 0`
- AlertDialog confirmation with count of selected items

**Employee-specific:** Bulk delete includes optional `deleteUsers` checkbox to also delete linked User accounts.

**Finance-specific:** Bulk delete of recurring parents cascades to projected children (`status: 'projected'`).

### Delete Pattern (Detail Pages)

For entity detail pages:
- Delete button in header with confirmation dialog
- **Call `logDelete()` BEFORE `prisma.X.delete()`** — record won't exist after
- Delete action with optional linked entity handling (e.g., delete linked user)
- Redirect to list page after successful delete

Reference implementations:

- List: `src/routes/(app)/employees/+page.svelte`, `src/routes/(app)/finances/income/+page.svelte`
- Detail: `src/routes/(app)/employees/[id]/+page.svelte`

---

## Modules

### Users & Settings

- User management with UserGroups and Permissions
- Enum type management (currencies, categories, statuses, tags)
- Audit log viewer (admin only)

### Clients

- Company/person records with contact info
- `paymentTerms: Int @default(30)` — used as default for income payment terms dropdown
- Link to projects, income, payments, offers
- Status: active, inactive
- Contacts via Person model (`personType: "client_contact"`)

### Vendors

- Supplier/service provider records
- `paymentTerms: Int @default(30)` — used as default for expense payment terms dropdown
- Link to expenses
- Categories managed via enums (`vendor_category`)
- Contacts via Person model (`personType: "vendor_contact"`)

### Employees

- Person records (`personType: "company_employee"`) with employment details
- Optional User account for system access (`userId String? @unique`)
- Salary fields: `salary`, `salary_tax`, `salary_bonus` (Decimal, restricted by permission)
- Status: active, on_leave, terminated
- Delete strategy: optional deactivation of linked User account (checkbox in delete dialog)

### Projects

- Projects are linked to a client and a company
- Projects can have many assigned employees and one project manager
- Project status: planning, active, on_hold, completed, cancelled, archived
- Description in markdown format (MarkdownEditor + MarkdownViewer components)
- Budget and estimated hours visible only for admin and accountant users
- Customizable milestones with dates, description, order, and completion tracking
- Projects can have many kanban boards

### Kanban Boards

- Kanban boards belong to a project and can have many members
- Admin can assign users to kanban boards from the users assigned to the project
- Only assigned members can see and edit a kanban board
- Member roles: `member`, `viewer`
- Columns and swimlanes with customizable names, colors, and ordering
- Default columns: Backlog, To Do, In Progress, Review, Done
- Default swimlanes: Bugs, New Requests, Tasks, Ideas
- Columns and swimlanes are collapsible (preferences stored per user in `UserBoardPreference`)
- Board settings page: drag-and-drop reordering, inline editing, color pickers, member management
- Deleting a column/swimlane with tasks is prevented (must move tasks first)

### Kanban Board Layout

- Board always uses the full width of the container element
- Board columns split the width equally (grid or flex layout) with 1px gap
- Board columns are collapsible. If a column collapses, all the other columns share the plus space equally
- Board columns have a sticky header with column title
- Board columns have the same width across swimlanes
- Board columns have a min-width of 200px
- Swimlanes are collapsible grid/flex rows with a full-width header

### Tasks

- Tasks belong to a project (required) and optionally a kanban board
- Fields: name, description (markdown), type, category, status, priority, column, swimlane, order
- People: creator, assignee, reviewers (Int[]), followers (Int[])
- Time tracking: dueDate, estimatedTime (minutes), spentTime (materialized aggregate from TimeRecords)
- Task statuses: backlog, todo, in_progress, review, done
- Task priorities: low, medium, high, urgent
- CRUD via API (`/api/tasks`) and `TaskDetailModal` component
- Bulk delete support with checkbox selection on task list page

### Time Records

- Time records belong to a task (`TimeRecord` model)
- Fields: date, minutes (Int), description, billable (Boolean), type (enum), category (enum), personId
- `DurationInput` component: accepts "1w 2d 3h 30m" format (1w = 5 working days, 1d = 8 hours)
- `recalcTaskSpentTime(taskId)` — aggregates SUM(minutes) and updates `task.spentTime`
- `formatMinutes(minutes)` — returns "Xh Ym" format
- Permission: editable by creator, admins, and project manager
- API: `POST /api/tasks/[id]/time-records`, `PATCH/DELETE /api/tasks/[id]/time-records/[recordId]`
- UI: `TimeRecordFormModal` for create/edit, `TaskTimeRecordsList` for display

### Notes

- Polymorphic: attachable to any entity via `entityType` + `entityId`
- Content in Markdown format (MarkdownEditor for editing, MarkdownViewer for display)
- Fields: content, priority (low/normal/high/urgent), color (hex), author
- API: `GET /api/notes?entityType=...&entityId=...`, `POST /api/notes`, `PATCH/DELETE /api/notes/[id]`
- Components: `NoteFormModal` (create/edit), `NotesList` (display with inline edit/delete)

### Tags

- Polymorphic: `EntityTag` model with `entityType`, `entityId`, `enumValueId`
- Tags are backed by `EnumValue` records (with color support)
- Each entity type can have its own tag enum (e.g., `task_tags`)
- Unique constraint: `[entityType, entityId, enumValueId]`

### Finances

- **Dashboard** (`/finances`): Monthly/quarterly/yearly financial overview
  - Period selector: 12 month tabs + Q1, Q2, Q3, Q4, Year shortcuts
  - Year navigation with arrow buttons, URL param-based (`?year=2026&period=3` or `?period=q1`)
  - 4 summary cards: Total Income, Total Expenses, Employee Costs, Balance
  - 3 side-by-side tables (Income, Expenses, Salaries) in `xl:grid-cols-3` layout
  - Balance = Income - (Expenses + Salaries + Salary Tax + Salary Bonus)
  - Employee salary totals multiplied by period months (3 for quarters, 12 for year)
  - Only shows employees with `salary > 0` and `employeeStatus: 'active'`
- **Income** (`/finances/income`): Track money coming in, link to client/project
  - List with search, sort, pagination, period selector, summary cards
  - Checkbox selection for bulk delete
  - CRUD via `IncomeFormModal` (modal) and full-page forms (`new/`, `[id]/edit/`)
  - API: `POST /api/income`, `GET/PUT/DELETE /api/income/[id]`
  - Tax percentage field (0-100%) with calculated `tax_value`
  - Payment terms dropdown (enum-based: 7, 14, 30 days) — auto-defaults from selected client
  - `dueDate` auto-calculated server-side: `date + paymentTermDays`
  - Status dropdown inline in table (via DropdownMenu)
  - Cumulative YTD balance card (income vs expenses) for month periods
- **Expenses** (`/finances/expenses`): Track money going out, link to vendor/project
  - Same list pattern as Income (search, sort, pagination, period, summary cards, bulk delete)
  - CRUD via `ExpenseFormModal` and full-page forms
  - API: `POST /api/expenses`, `GET/PUT/DELETE /api/expenses/[id]`
  - Payment terms dropdown — auto-defaults from selected vendor
  - Receipt file upload support (`receiptPath`)
- **Payments** (`/finances/payments`): Payment transactions, reconciliation (not yet implemented)
- All financial fields use `Decimal @db.Decimal(10, 2)` in Prisma schema
- Decimal fields must be serialized to Number before passing to client: `Number(inc.amount)`

### Recurring Income/Expenses

- Parent records have `isRecurring: true`, `recurringPeriod`, `recurringEndDate`
- Child records have `parentId` pointing to parent, `status: 'projected'`
- `recurring.ts` functions:
  - `generateOccurrenceDates(startDate, period, endDate)` — generates date array
  - `advanceDate()` — handles weekly/biweekly/monthly/quarterly/yearly with month-end clamping
  - `generateIncomeOccurrences(parentId, userId)` — deletes old projected children, creates new batch
  - `generateExpenseOccurrences(parentId, userId)` — same pattern
  - `promoteProjectedRecords()` — updates status from `projected` to `pending` when `date <= today`
- Each projected child gets its own `dueDate` calculated from its date + parent's `paymentTermDays`
- Copying fields from parent: amount, tax, tax_value, currency, description, category, paymentTermDays, etc.
- Delete cascade: deleting a recurring parent also deletes all projected children (via `onDelete: Cascade`)
- Edit choice dialog: for projected occurrences, user can choose "Edit this occurrence" or "Edit original record"
- Form modal shows recurring fields: checkbox, period dropdown, end date with quick-fill buttons

### Payment Terms

- `payment_terms` enum: values are `'7'`, `'14'`, `'30'` with labels "7 Days", "14 Days", "30 Days"
- Income/Expense models have `paymentTermDays Int?` field
- `dueDate` is auto-calculated server-side: `new Date(date.getTime() + paymentTermDays * 86400000)`
- Form modals show Select dropdown for payment terms + read-only calculated due date preview
- Auto-default: when client/vendor is selected, populate from `client.paymentTerms` / `vendor.paymentTerms`
- Client/Vendor edit forms use the same enum dropdown for their `paymentTerms` field

### Offers

- Quote/proposal generation for clients
- Line items from price list or custom
- PDF generation and email sending
- Status workflow: draft → sent → accepted/rejected/expired
- Convert to project

### Price Lists

- Product/service catalog with pricing
- Categories, units of measure
- Excel import/export
- SKU support (unique)

---

## Shared Components

### MarkdownEditor (`src/lib/components/shared/MarkdownEditor.svelte`)
- Built on `carta-md` (CartaEditor)
- Sanitization via `DOMPurify.sanitize(html)`
- Props: `value` (bindable), `placeholder`, `mode` ('tabs'|'split'|'auto'), `disableToolbar`, `class`

### MarkdownViewer (`src/lib/components/shared/MarkdownViewer.svelte`)
- Built on `carta-md` (Markdown component)
- Sanitization via `DOMPurify.sanitize(html)`
- Props: `value`, `class`
- Uses `{#key value}` wrapper for re-render on content change

### ColorInput (`src/lib/components/shared/ColorInput.svelte`)
- Combined color picker + hex text input
- Props: `value` (bindable hex string), `size` ('default'|'sm'), `clearable`
- Auto-prepends `#`, validates 3/6-digit hex, syncs picker and text

### DurationInput (`src/lib/components/shared/DurationInput.svelte`)
- Human-friendly duration input: "1w 2d 3h 30m"
- Working time: 1w = 5 days, 1d = 8 hours
- Props: `value` (minutes), `onchange`, `placeholder`, `required`, `id`, `name`
- Reformats on blur, allows free editing while focused

### DateRangeSelector (`src/lib/components/shared/DateRangeSelector.svelte`)
- Period selector with month tabs + quarter/year shortcuts
- Year navigation with arrow buttons

### Button Component (`src/lib/components/ui/button/button.svelte`)
- Uses `tailwind-variants` (tv) for variant styling
- Includes `cursor-pointer` in base class (ensures pointer cursor on `<button>` elements, not just `<a>` tags)

---

## Database Models

Key models (see `prisma/schema.prisma` for full schema):

- **User** (String ID, cuid) - Auth.js compatible, has `password`, `name`, `email`
- **UserGroup, Permission, GroupPermission** - RBAC with module+action pairs
- **AuditLog** - Action logging with JSON `oldValues`/`newValues`
- **EnumType, EnumValue** - Dynamic enums with color, metadata, sort order
- **Company** - Single company with settings (currency, fiscal year)
- **Person** - Central contact: `personType` discriminator ("company_employee", "client_contact", "vendor_contact")
  - Employee fields: salary, salary_tax, salary_bonus, hireDate, department, jobTitle, employeeStatus
  - Links to User via `userId String? @unique`
- **Client** - Company client with paymentTerms, currency, industry
- **Vendor** - Supplier with paymentTerms, currency, category
- **Project** - Linked to client, has budget, milestones, kanban boards
- **ProjectEmployee** - Many-to-many: project ↔ person with role
- **Task** - Belongs to project, optional kanban board placement, time tracking
- **TimeRecord** - Belongs to task, minutes-based, billable flag, personId
- **Milestone** - Belongs to project, with completion tracking
- **KanbanBoard, KanbanColumn, KanbanSwimlane** - Board structure with ordering and colors
- **KanbanBoardMember** - Board access control with roles
- **UserBoardPreference** - Collapsed columns/swimlanes per user
- **Note** - Polymorphic (`entityType` + `entityId`), markdown content, priority, color
- **EntityTag** - Polymorphic tags backed by EnumValue
- **Income** - Financial record with recurring support, paymentTermDays, tax fields, `clientName` (denormalized)
- **Expense** - Same as Income but linked to vendor, has receiptPath, `vendorName` (denormalized)
- **Payment** - Payment transactions (received/paid), reconciliation
- **PriceListItem** - Catalog with SKU, pricing, validity dates
- **Offer, OfferItem** - Quotes with line items, status workflow, PDF support

All models have `createdAt/updatedAt` timestamps. Deletions are hard deletes with audit log snapshots.
All financial amounts use `Decimal @db.Decimal(10, 2)`. Tax rates use `Decimal @db.Decimal(5, 2)`.
IDs are `Int @id @default(autoincrement())` except User/Account/Session which use `String @id @default(cuid())` for Auth.js compatibility.

---

## Environment Variables

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="..."
UPLOAD_DIR="/var/uploads"
MAX_FILE_SIZE="10485760"
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
```

---

## Development Commands

```bash
# Start dev server
npm run dev

# Database
npx prisma migrate dev    # Create migration
npx prisma generate       # Regenerate client
npx prisma db seed        # Run seed
npx prisma studio         # Open GUI

# Quick database refresh (project script)
db-refresh                # Apply pending migrations
db-refresh reset          # Full reset (drop + recreate + seed)

# Type checking
npx svelte-check          # Check for TypeScript/Svelte errors

# Build
npm run build
```

### Known Issues

- 8 pre-existing lucide-svelte type compatibility errors (`Type 'typeof X' is not assignable to type 'Component<...>'`). These are false positives from icon type definitions and do not affect runtime behavior.

---

## Deployment Checklist

1. Configure environment variables
2. Run `npx prisma migrate deploy`
3. Seed initial data (permissions, enums)
4. Set up Nginx reverse proxy with SSL
5. Configure PM2 or systemd service
6. Set up database backups
7. Configure file upload directory permissions

---

## Guidelines for Development

### Priorities

1. Security: Always enforce permissions and audit logging
2. Consistency: Follow established patterns
3. Type safety: Use TypeScript strictly
4. UX: Clear error messages, loading states, confirmations

### When Creating Features

1. Check existing patterns (reuse components and server utilities)
2. Add appropriate permissions via `requirePermission()`
3. Implement audit logging via `logCreate/logUpdate/logDelete`
4. Use hard delete with `logDelete()` BEFORE `prisma.X.delete()` for audit trail
5. Use enums for dropdowns where applicable (register in `ALL_ENUM_CODES`, seed in `seed.ts`)
6. Add checkbox selection for bulk delete on list pages
7. Prevent event bubbling on action cells in clickable table rows
8. Serialize Decimal fields to Number before passing to client

### Form Patterns

Two patterns are used for CRUD operations:

1. **Full-page forms** (clients, vendors, employees, projects, pricelists): SvelteKit form actions with `use:enhance`, hidden inputs, server-side validation
2. **Modal forms** (income, expenses, tasks, notes, time records): Fetch-based API calls, client-side state, `invalidateAll()` on save

### Naming Conventions

- Components: PascalCase (`ClientForm.svelte`, `IncomeFormModal.svelte`)
- Files: kebab-case (`access-control.ts`, `rate-limit.ts`)
- Variables/functions: camelCase
- Database tables: PascalCase (Prisma model names)
- Database fields: camelCase (with snake_case exceptions: `tax_value`, `salary_tax`, `salary_bonus`)
- Enum codes: snake_case (`income_category`, `payment_terms`)
- URL params: camelCase (`sortBy`, `sortOrder`, `clientId`, `isRecurring`)

### Database Changes

- Always create migrations (`npx prisma migrate dev --name description`)
- Update `seed.ts` if adding new enum types
- Run `npx prisma generate` after schema changes
- Register new enum codes in `ALL_ENUM_CODES` in `src/lib/server/enums.ts`

---

## Resources

- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/what-are-runes)
- [Prisma Docs](https://www.prisma.io/docs)
- [shadcn-svelte](https://www.shadcn-svelte.com)
- [Superforms](https://superforms.rocks)
- [carta-md](https://github.com/BearToCode/carta)
