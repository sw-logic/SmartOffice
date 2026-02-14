# Clients Module

Company/person records with contact management, linked to projects, income, offers, services, and leads.

## Routes

| Route | Pattern | Purpose |
|-------|---------|---------|
| `/clients` | List page | Clients list with search, sort, pagination, status/industry filter |
| `/clients/new` | Full-page form | Create client |
| `/clients/[id]` | Detail page | Client details with tabs: Notes, Contacts, Projects, Services, Boards, Tasks, Offers, Income, Expenses |
| `/clients/[id]/edit` | Full-page form | Edit client |

## Client Model

Key fields:
- `name` (String, required) — Display name
- `companyName` (String?) — Legal/full company name
- `email` (String?) — Primary email
- `phone` (String?) — Primary phone
- `website` (String?) — Website URL
- `industry` (String?) — Enum `client_industry`
- `status` (String, default "active") — Enum `entity_status`
- `paymentTerms` (Int, default 30) — Default payment terms in days
- `currency` (String, default "USD") — Default currency
- `notes` (String?) — Plain text notes
- Address fields: `street`, `city`, `postalCode`, `country` (all String?)
- Business fields: `taxId`, `vatNumber` (all String?)

Relations:
- `companyId` / `company` (Company, required)
- `createdById` / `createdBy` (User)
- `contacts` (Contact[], onDelete: Cascade)
- `projects` (Project[])
- `income` (Income[], onDelete: SetNull)
- `payments` (Payment[])
- `offers` (Offer[])
- `leads` (Lead[])
- `services` (Service[])
- `hostingSites` (HostingSite[])

Indexes: `companyId`, `email`, `status`

## Contact Model

Key fields:
- `firstName` (String, required), `lastName` (String, required)
- `email` (String?), `phone` (String?), `mobile` (String?)
- `position` (String?) — Job title
- `avatarPath` (String?) — Avatar file path
- `isPrimaryContact` (Boolean, default false)

Relations:
- `clientId` (Int?) — FK to Client (onDelete: Cascade)
- `vendorId` (Int?) — FK to Vendor (onDelete: Cascade)
- `leads` (Lead[]), `services` (Service[])

Indexes: `clientId`, `vendorId`

## List Page Features

- **Search**: name, companyName, email (case-insensitive)
- **Sort**: name, email, city, createdAt
- **Status filter**: active (default), inactive, archived, all
- **Table columns**: Client (avatar + name + company), Email, Location, Industry, Status, Projects/Contacts count, Created, Actions
- **Clickable rows** with event bubbling prevention on action cells
- **Delete**: `createDeleteAction` factory, hard delete with audit log
- **List state persistence**: saves/restores URL params via sessionStorage

## Detail Page

**Header**: Back button, client name + status badge, company name, Edit button

**Left sidebar (1/3)**:
1. **Client Information Card** — email (mailto), phone (tel), website (external link), industry, address, tax ID, VAT, payment terms, currency, notes, created date
2. **Overview Card** — Projects count, Contacts count, Offers count, Total Income (permission-gated, green)

**Right content (2/3) — Tabbed**:
1. **Notes** — `NotesList` (polymorphic, entityType="Client")
2. **Contacts** — Table with Add/Edit/Delete, `ContactFormModal`, avatar upload (2MB max, JPG/PNG/WebP)
3. **Projects** — Table (name, status, dates), "New Project" button, limited to 10
4. **Services** — Table (name, type, status, fee, assigned to), permission-gated
5. **Boards** — Kanban boards through projects (name, project, members, tasks)
6. **Tasks** — Open tasks through projects (priority, task, project, assignee, status, due date)
7. **Offers** — Table (offer #, date, status, total), permission-gated
8. **Income** — Table (date, description, category, status, amount), permission-gated
9. **Expenses** — Expenses through projects, permission-gated

**Contact CRUD** (server actions on detail page):
- `?/createContact` — firstName/lastName required, avatar upload via `saveAvatar()`
- `?/updateContact` — with avatar upload/removal
- `?/deleteContact` — hard delete with audit log

## Form Structure

**Card 1: Basic Information**
- Client Name* (required), Company Name
- Email (validated: regex), Phone
- Website (validated: must start with http/https)
- Industry (enum `client_industry`), Status (enum `entity_status`)

**Card 2: Address**
- Street, City, Postal Code, Country

**Card 3: Business Information**
- Tax ID, VAT Number
- Payment Terms (enum `payment_terms`), Currency (enum `currency`)
- Notes (textarea)

## Enums

| Code | Module | Purpose |
|------|--------|---------|
| `client_industry` | Clients | Industry classification |
| `entity_status` | Generic | Status (active, inactive, archived) |
| `currency` | Generic | Default currency |
| `payment_terms` | Finances | Default payment terms (7, 14, 30 days) |

## Permissions

Module: `clients` — Actions: `read`, `create`, `update`, `delete`, `export`, `contacts`

Cross-module checks on detail page:
- `finances.income.read` — Income tab
- `finances.expenses.read` — Expenses tab
- `offers.read` — Offers tab (via `finances.offers`)
- `services.read` — Services tab
