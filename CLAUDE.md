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
- **Database**: PostgreSQL 16 with Prisma ORM
- **Auth**: Auth.js with Credentials provider
- **UI**: shadcn-svelte + TailwindCSS + lucide-svelte
- **Forms**: Superforms with Zod validation
- **Notifications**: svelte-sonner

### Additional Libraries

- **date-fns** - Date manipulation
- **jsPDF / @pdfme** - PDF generation
- **xlsx (SheetJS)** - Excel import/export
- **Nodemailer** - Email sending
- **svelte-dnd-action** - Drag-and-drop for kanban

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
│   │   ├── ui/           # shadcn-svelte components
│   │   ├── layout/       # Sidebar, Header, etc.
│   │   └── shared/       # DataTable, StatusBadge, etc.
│   ├── server/
│   │   ├── prisma.ts     # Prisma client
│   │   ├── access-control.ts
│   │   ├── audit.ts
│   │   ├── enums.ts      # Enum management utility
│   │   └── email.ts
│   ├── stores/
│   └── utils/
├── routes/
│   ├── (auth)/           # Public auth routes (login)
│   ├── (app)/            # Protected app routes
│   │   ├── dashboard/
│   │   ├── clients/
│   │   ├── vendors/
│   │   ├── employees/
│   │   ├── projects/
│   │   ├── finances/     # income, expenses, payments
│   │   ├── offers/
│   │   ├── pricelists/
│   │   └── settings/     # users, groups, enums
│   └── api/
└── hooks.server.ts       # Auth middleware
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
- Permissions are module + action based: `module.action` (e.g., `clients.read`)
- Users belong to UserGroups which have Permissions
- Use `requirePermission(locals, module, action)` in every server action
- Use `checkPermission(userId, module, action)` for conditional UI

### Soft Delete

- All models have `deletedAt: DateTime?` field
- Queries filter out soft-deleted records by default
- Admin users can view and restore deleted records
- Use status filter: active/deleted/all (admin-only)

### Audit Logging

- Log all important actions: create, update, delete, login
- Capture: userId, action, module, entityId, oldValues, newValues
- Use `logAction()` and `logDelete()` utilities

### Enum Management

- Dynamic enums stored in `EnumType` and `EnumValue` tables
- Grouped by module: Generic, Finances, Clients, Vendors, Employees, Projects, Offers, Price Lists
- Use `getEnumValues(typeCode)` to load enums in server load functions
- Manage via Settings > Enums admin UI

---

## List View Pattern

Standard features for all list pages:

- **Search**: Input with Enter to search
- **Sorting**: Clickable column headers with asc/desc toggle
- **Pagination**: Page navigation with item count
- **Status Filter**: Admin-only Active/Deleted/All filter
- **Clickable Rows**: Click row to navigate to detail view
- **Actions**: View, Edit, Delete (soft), Restore (admin-only)
- **Confirmation Dialogs**: For destructive actions
- **Toast Notifications**: Success/error feedback

Reference implementations:

- `src/routes/(app)/users/+page.svelte`
- `src/routes/(app)/clients/+page.svelte`

---

## Modules

### Users & Settings

- User management with UserGroups and Permissions
- Enum type management (currencies, categories, statuses)
- Audit log viewer (admin only)

### Clients

- Company/person records with contact info
- Link to projects, income, payments, offers
- Status: active, inactive

### Vendors

- Supplier/service provider records
- Link to expenses
- Categories managed via enums

### Employees

- Person records with employment details
- Optional User account for system access
- Salary field (restricted by permission)
- Status: active, on_leave, terminated

### Projects

- Projects are linked to a client
- Projects can have many assigned users and one project manager
- Project status: planning, active, on hold, completed, canceled, archived
- Projects has an editable description in markdown format (Svelte compatible Markdown text editor)
- Project has a budget and estimated working hours which is visible only for admin and accountant users
- Project has customizable milestones with dates and description
- Project can have many kanban boards

### Kanban boards

- Kanban boards can have many users,
- Admin can assign users to kanban boards from the users assigned to the project
- Only assigned users can see and edit a kanban board
- Kanban boards have columns and swimlanes
- Default columns: 'Backlog' 'To Do' 'In Progress' 'Review' 'Done'
- Default swimlanes: 'Bugs' 'New Requests' 'Tasks' 'Ideas'
- Columns and swimlanes are collapsible to save screenspace
- Admins can add new custom columns and swimlanes to any kanban board
- Admin can change the order of the columns and swimlanes
- Kanban boards have many tasks

### Kanban Board layout

- Board always use the full with of the container element
- Board columns split the width equally (grid or flex layout) with 1px gap
- Board columns are collapsible. If a column collapses, all the other columns share the plus space equally
- Board columns has a sticky header with column title
- Board columns has the same with across swimlanes
- Board columns has a min-width of 200px
- Swimlanes are collapsible grid/flex rows with a full-with header

```
<kanban>
    <kanban-sticky-header>
        <kanban-column>
            <kanban-column-title>
        </kanban-column>
        <kanban-column>
            <kanban-column-title>
        </kanban-column>
        <kanban-column>
            <kanban-column-title>
        </kanban-column>
    </kanban-header>
    <kanban-swimlane>
        <kanban-swimlane-header>
        <kanban-row>
            <kanban-column>
                <kanban-task>
                <kanban-task>
                <kanban-task>
            </kanban-column>
                <kanban-task>
            <kanban-column>
            </kanban-column>
            <kanban-column>
                <kanban-task>
            </kanban-column>
        <kanban-row>
    </kanban-swimlane>
    <kanban-swimlane>
    ...
    </kanban-swimlane>
</kanban>
```

### Tasks

- Tasks have name, description, type, category, state, column position, swimlane position, creator, creation date, due date, assignee,
  followers, reviewers, estimated time, spent time, notes
- Task description is in markdown format (Svelte compatible Markdown text editor)

### Time Records
- Time records belong to a task
- Many time records can belong to one task
- Time record has a creator, selectable date, description, type(enum), category(enum)
- Creator, Admins, Project manager can edit the time records 

### Notes

- Notes can be attached to all entities in the application
- Notes are in Markdown format
- Notes have creation date, author, priority, color

### Tags
- Tags can be attached to all entities in the application
- Every entity can have different sets of tags managed as enums
- All tags can have different colors

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
  - List with search, sort, pagination, status filter
  - CRUD via form pages (`new/`, `[id]/edit/`) and `IncomeFormModal.svelte`
  - API: `POST /api/income`, `GET/PUT/DELETE /api/income/[id]`
  - Tax percentage field (0-100%) with calculated tax_value
- **Expenses** (`/finances/expenses`): Track money going out, link to vendor/project
  - Same list pattern as Income
  - CRUD via form pages and `ExpenseFormModal.svelte` (matches Income modal layout)
  - API: `POST /api/expenses`, `GET/PUT/DELETE /api/expenses/[id]`
  - Tax percentage field (0-100%) with calculated tax_value
- **Payments** (`/finances/payments`): Payment transactions, reconciliation (not yet implemented)
- Recurring income/expenses support with configurable period
- All financial fields use `Decimal @db.Decimal(10, 2)` in Prisma schema

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

---

## Database Models

Key models (see `prisma/schema.prisma` for full schema):

- **User, UserGroup, Permission** - Auth & RBAC
- **AuditLog** - Action logging
- **EnumType, EnumValue** - Dynamic enums
- **Client, Vendor, Person** - Contacts
- **Project, Task, ProjectEmployee** - Project management
- **Income, Expense, Payment** - Finances
- **Offer, OfferItem, PriceListItem** - Offers & pricing

All models have `deletedAt` for soft delete and `createdAt/updatedAt` timestamps.

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

# Build
npm run build
```

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

1. Check existing patterns (reuse components)
2. Add appropriate permissions
3. Implement audit logging
4. Support soft delete
5. Use enums for dropdowns where applicable

### Naming Conventions

- Components: PascalCase (`ClientForm.svelte`)
- Files: kebab-case (`access-control.ts`)
- Variables/functions: camelCase
- Database tables: PascalCase
- Database fields: camelCase

### Database Changes

- Always create migrations (`npx prisma migrate dev`)
- Update seed.ts if adding new enum types
- Run `npx prisma generate` after schema changes

---

## Resources

- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/what-are-runes)
- [Prisma Docs](https://www.prisma.io/docs)
- [shadcn-svelte](https://www.shadcn-svelte.com)
- [Superforms](https://superforms.rocks)
