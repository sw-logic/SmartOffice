# Vendors Module

Supplier/service provider records with contact management, linked to expenses.

## Routes

| Route | Pattern | Purpose |
|-------|---------|---------|
| `/vendors` | List page | Vendors list with search, sort, pagination, status/category filter |
| `/vendors/new` | Full-page form | Create vendor |
| `/vendors/[id]` | Detail page | Vendor details with tabs: Notes, Contacts, Expenses |
| `/vendors/[id]/edit` | Full-page form | Edit vendor |

## Vendor Model

Key fields:
- `name` (String, required) — Display name
- `companyName` (String?) — Legal/full company name
- `email` (String?), `phone` (String?)
- `website` (String?) — Website URL
- `category` (String?) — Enum `vendor_category`
- `status` (String, default "active") — Enum `entity_status`
- `paymentTerms` (Int, default 30) — Default payment terms in days
- `currency` (String, default "USD")
- `notes` (String?)
- Address fields: `street`, `city`, `postalCode`, `country` (all String?)
- Business fields: `taxId`, `vatNumber` (all String?)

Relations:
- `contacts` (Contact[], onDelete: Cascade)
- `expenses` (Expense[], onDelete: SetNull)

Indexes: `email`, `status`, `category`

**Key difference from Clients**: No `companyId`, uses `category` instead of `industry`, only links to expenses (not projects/income/offers/services).

## List Page Features

- **Search**: name, companyName, email (case-insensitive)
- **Sort**: name, email, city, createdAt
- **Status filter**: active (default), inactive, all
- **Category filter**: dropdown of distinct category values (only shown if categories exist)
- **Table columns**: Vendor (avatar + name + company), Email, Location, Category, Status, Expenses/Contacts count, Created, Actions
- **Clickable rows** with event bubbling prevention on action cells
- **Delete**: `createDeleteAction` factory, hard delete with audit log
- **List state persistence**: saves/restores URL params via sessionStorage

## Detail Page

**Header**: Back button, vendor name + status badge, company name, Edit button

**Left sidebar (1/3)**:
1. **Vendor Information Card** — email, phone, website, category, address, tax ID, VAT, payment terms, currency, notes, created date
2. **Overview Card** — Expenses count, Contacts count, Total Expenses (permission-gated, red)

**Right content (2/3) — Tabbed**:
1. **Notes** — `NotesList` (polymorphic, entityType="Vendor")
2. **Contacts** — Table with Add/Edit/Delete, `ContactFormModal`, avatar upload
3. **Expenses** — Table (date, description, category, status, amount), permission-gated, limited to 10

**Contact CRUD** (server actions):
- `?/createContact`, `?/updateContact`, `?/deleteContact`
- Permission: `vendors.contacts`
- Same pattern as Clients (shared `ContactFormModal` component)

## Form Structure

**Card 1: Basic Information**
- Vendor Name* (required), Company Name
- Email (validated), Phone, Website (validated)
- Category (enum `vendor_category`), Status (enum `entity_status`)

**Card 2: Address**
- Street, City, Postal Code, Country

**Card 3: Business Information**
- Tax ID, VAT Number
- Payment Terms (enum `payment_terms`), Currency (enum `currency`)
- Notes (textarea)

## Denormalized Names

`Expense.vendorName` — preserved when vendor deleted. Populated on expense create/update.

Display pattern: `expense.vendor?.name || expense.vendorName || '-'`

## Enums

| Code | Module | Purpose |
|------|--------|---------|
| `vendor_category` | Vendors | Vendor type classification |
| `entity_status` | Generic | Status (active, inactive) |
| `currency` | Generic | Default currency |
| `payment_terms` | Finances | Default payment terms |

## Permissions

Module: `vendors` — Actions: `read`, `create`, `update`, `delete`, `export`, `contacts`

Cross-module checks on detail page:
- `finances.expenses.read` — Expenses tab
