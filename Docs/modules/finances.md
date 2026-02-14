# Finances Module

Income/expense tracking with recurring transactions, period-based reporting, tax calculation, and payment term management.

## Routes

| Route | Pattern | Purpose |
|-------|---------|---------|
| `/finances` | Dashboard | Monthly/quarterly/yearly overview with summary cards and tables |
| `/finances/income` | List page | Income list with period filter, grouping, bulk operations |
| `/finances/income/new` | Full-page form | Create income |
| `/finances/income/[id]` | Detail page | Income details |
| `/finances/income/[id]/edit` | Full-page form | Edit income |
| `/finances/expenses` | List page | Expenses list (same pattern as income) |
| `/finances/expenses/new` | Full-page form | Create expense |
| `/finances/expenses/[id]` | Detail page | Expense details |
| `/finances/expenses/[id]/edit` | Full-page form | Edit expense |

## API Endpoints

### Income

| Method | Route | Permission | Purpose |
|--------|-------|------------|---------|
| POST | `/api/income` | `finances.income.create` | Create income (+ generate recurring children) |
| GET | `/api/income/[id]` | `finances.income.read` | Get income with relations |
| PATCH | `/api/income/[id]` | `finances.income.update` | Update income (creator/admin only) |

### Expenses

| Method | Route | Permission | Purpose |
|--------|-------|------------|---------|
| POST | `/api/expenses` | `finances.expenses.create` | Create expense (+ generate recurring children) |
| GET | `/api/expenses/[id]` | `finances.expenses.read` | Get expense with relations |
| PATCH | `/api/expenses/[id]` | `finances.expenses.update` | Update expense (creator/admin only) |

## Income Model

Key fields:
- `amount` (Decimal(10,2)) — Main amount
- `tax` (Decimal(10,2), default 0) — Tax percentage (0-100)
- `tax_value` (Decimal(10,2), default 0) — Calculated: `amount × (tax / 100)`
- `currency` (String, default "USD")
- `date` (DateTime) — Transaction date
- `description` (String) — Description/invoice info
- `category` (String) — Enum `income_category`
- `status` (String, default "pending") — Enum `income_status`
- `dueDate` (DateTime?) — Auto-calculated: `date + paymentTermDays × 86400000`
- `paymentTermDays` (Int?) — Payment terms in days

Recurring fields:
- `isRecurring` (Boolean, default false)
- `recurringPeriod` (String?) — weekly, biweekly, monthly, quarterly, yearly
- `recurringEndDate` (DateTime?) — Generate projections until this date
- `parentId` (Int?) — Self-reference to recurring parent

Relations:
- `clientId` / `client` (Client?, onDelete: SetNull)
- `projectId` / `project` (Project?, onDelete: SetNull)
- `paymentId` / `payment` (Payment?)
- `createdById` / `createdBy` (User)
- `parent` / `children` (self-relation for recurring)

Denormalized: `clientName` — preserved when client deleted.

Indexes: `date`, `clientId`, `projectId`, `category`, `status`, `dueDate`, `parentId`

## Expense Model

Same structure as Income, with:
- `vendorId` / `vendor` (Vendor?, onDelete: SetNull) instead of clientId
- `vendorName` (denormalized) instead of clientName
- `receiptPath` (String?) — Receipt file upload
- Different categories (see Enums section)

## Payment Model

Key fields:
- `amount` (Decimal(10,2)), `currency`, `date`
- `type` (String) — "received" or "paid"
- `method` (String) — bank_transfer, cash, credit_card, check, other
- `status` (String) — pending, completed, failed, cancelled
- `referenceNumber` (String?) — Bank transaction/check number
- `reconciled` (Boolean, default false)

Relations:
- `clientId` / `client` (Client?)
- `income` / `expense` (one-to-one reverse)

## Dashboard (`/finances`)

**Period selector**: 12 month tabs + Q1/Q2/Q3/Q4/Year shortcuts
**Year navigation**: Arrow buttons, URL params (`?year=2026&period=3` or `?period=q1`)

**4 Summary Cards**:
1. Total Income (green)
2. Total Expenses (red)
3. Employee Costs (orange) — salary + tax + bonus × period months
4. Balance (green/red) — `Income - (Expenses + Employee Costs)`

**3 Side-by-side Tables** (`xl:grid-cols-3`):
- Income table (date, description, client, status, amount)
- Expenses table (date, description, vendor, status, amount)
- Salaries table (employee + avatar, salary, tax, bonus)

Employee costs calculation:
- Filters: `employeeStatus: 'active'` AND `salary > 0`
- Period multiplier: month = 1×, quarter = 3×, year = 12×

## Income/Expense List Pages

**Features** (identical pattern for both):
- **Period selector**: Same as dashboard
- **Filters**: Search, status, category, client/vendor, recurring type, group-by
- **Summary cards**: Total, Tax Value, Record Count, Average, YTD Balance (months only)
- **Table**: Checkbox, Date (+due date), Description, Client/Vendor, Category, Status (inline dropdown), Recurring badge, Amount, Tax %, Tax Value, Actions
- **Projected rows**: `opacity-60` with `border-dashed`
- **Edit choice dialog**: For projected occurrences — "Edit this occurrence" or "Edit original record"
- **Bulk delete**: Checkbox selection, cascades projected children
- **Inline status update**: Dropdown menu in status column
- **Pagination**: 50 records per page
- **Grouping**: By category or status with collapsible sections and subtotals

## Form Components

### IncomeFormModal / ExpenseFormModal
- Modal dialog with fetch-based API calls
- Three-column layout: amount, tax %, currency
- Client/vendor selection → auto-populate payment terms
- Calculated due date preview (real-time)
- Recurring section: checkbox, period dropdown, "Generate until" date with quick-fill buttons
- Projected occurrence banner with "View original record" link

### Full-Page Forms (Create/Edit)
- SvelteKit form actions with `use:enhance`
- Same fields as modal forms
- Server-side validation with error messages

## Recurring System (`src/lib/server/recurring.ts`)

### Concept
- **Parent record**: `isRecurring: true` with `recurringPeriod` and `recurringEndDate`
- **Child records**: `parentId` → parent, `status: 'projected'`
- **Cascade delete**: Deleting parent deletes all projected children

### Key Functions

| Function | Purpose |
|----------|---------|
| `generateOccurrenceDates(start, period, end)` | Generate date array for recurring schedule |
| `advanceDate(date, period, anchorDay, anchorMonth)` | Advance date by one period with month-end clamping |
| `generateIncomeOccurrences(parentId, userId)` | Delete old projected children, create new batch |
| `generateExpenseOccurrences(parentId, userId)` | Same for expenses |
| `generateServiceIncome(service, userId)` | Create recurring Income parent linked to a Service |
| `promoteProjectedRecords()` | Update `projected` → `pending` when `date <= today` |

### Generation Flow
1. Parent created with `isRecurring: true` + `recurringEndDate`
2. API calls `generateIncomeOccurrences(parentId, userId)`
3. Function deletes existing projected children
4. Generates occurrence dates via `generateOccurrenceDates()`
5. Maps dates to records (copy parent fields, set `status: 'projected'`, calculate `dueDate`)
6. Bulk creates via `prisma.income.createMany()`

### Promotion
On every list page load, `promoteProjectedRecords()` updates `projected` → `pending` for records with `date <= today`.

### Month-End Clamping
For monthly/quarterly/yearly periods, if anchor day (e.g., 31) exceeds target month's days, clamps to last day of month.

## Tax Calculation

- `tax` — percentage (0-100)
- `tax_value` — calculated: `amount × (tax / 100)`, rounded to 2 decimals
- Calculated on create and update (when amount or tax changes)

## Payment Terms

- Enum `payment_terms`: values `'7'`, `'14'`, `'30'` (string days)
- `dueDate` auto-calculated server-side: `date + paymentTermDays × 86400000`
- Auto-defaults from selected client/vendor's `paymentTerms` field
- Real-time preview in form modals via `$derived`

## Denormalized Names

- `Income.clientName` — preserved when client deleted
- `Expense.vendorName` — preserved when vendor deleted
- Populated on create, update, and recurring generation
- Display: `entity.client?.name || entity.clientName || '-'`

## Currency Formatting (`src/lib/utils/currency.ts`)

- `formatCurrency(amount, code?, enums?)` — plain text: "10 000 Ft"
- `formatCurrencyHtml(amount, code?, enums?)` — HTML with styled symbol
- `createCurrencyFormatter(enums, defaultCode?)` — bound formatter
- Built-in defaults: HUF (0 decimals, hu-HU), USD (2, en-US), EUR (2, de-DE), GBP (2, en-GB)
- `Intl.NumberFormat` cached by locale+currency+decimals key

## Grouping (`src/lib/utils/group-by.ts`)

- `groupFinanceRecords(records, groupBy, enums)` — groups by category or status
- Returns `GroupedSection[]` with key, label, color, items, subtotals (amount, taxValue, count)
- UI: `GroupHeaderRow` component, collapsible sections with `expandedGroups: Set<string>`

## Decimal Serialization

- Prisma `Decimal` → `Number` via `serializeDecimals(record, fields)` helper
- Applied in all server load functions and API responses
- Fields: `amount`, `tax`, `tax_value`, `budgetEstimate`, `estimatedHours`

## Enums

| Code | Module | Purpose |
|------|--------|---------|
| `income_category` | Finances | Income categories (7 values) |
| `income_status` | Finances | Income status (paid, pending, late, suspended, projected) |
| `expense_category` | Finances | Expense categories (12 values) |
| `expense_status` | Finances | Expense status |
| `payment_method` | Finances | Payment methods |
| `payment_status` | Finances | Payment status |
| `payment_terms` | Finances | Payment terms (7, 14, 30 days) |
| `recurring_period` | Finances | Recurring periods (weekly through yearly) |
| `currency` | Generic | Currencies with metadata |

## Permissions

Income: `finances.income` — Actions: `read`, `create`, `update`, `delete`
Expenses: `finances.expenses` — Actions: `read`, `create`, `update`, `delete`
Payments: `finances.payments` — Actions: `read`, `create`, `update`, `delete`
Salaries: `employees.salary` — View employee salary data on dashboard

Row-level: Income/expense update restricted to creator or admin.
