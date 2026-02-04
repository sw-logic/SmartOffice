# Company Management System - Development Blueprint

## Project Overview

### Purpose
A comprehensive web-based company management system for managing clients, employees, projects, finances (income/expenses/payments), price lists, and offers. The system emphasizes security, auditability, and ease of use with a modern interface.

### Key Characteristics
- **Multi-tenant ready**: Support multiple companies/organizations
- **Role-based access control**: Fine-grained permissions system
- **Audit trail**: Complete logging of all important actions
- **Data safety**: Soft-delete to prevent accidental data loss
- **Scalable architecture**: Easy to add new modules
- **Modern UI/UX**: Consistent design with light/dark mode

### Target Users
- Company administrators
- Managers
- Employees
- Accountants/Financial staff

---

## Technical Stack

### Core Framework
- **Frontend Framework**: SvelteKit (latest)
- **Language**: TypeScript
- **Node Version**: 20.x LTS

### Database & ORM
- **Database**: PostgreSQL 16 (Docker-based for development)
- **ORM**: Prisma (latest)
- **Connection Pooling**: Prisma's built-in pooling

### Authentication & Authorization
- **Auth Library**: Auth.js (formerly NextAuth.js)
- **Auth Strategy**: Credentials (email/password) + OAuth providers optional
- **Session Management**: Database sessions with Prisma adapter

### UI Components & Styling
- **Component Library**: shadcn-svelte
- **CSS Framework**: TailwindCSS
- **Icons**: lucide-svelte
- **Forms**: Superforms (SvelteKit form library)
- **Tables**: TanStack Table (@tanstack/svelte-table)
- **Toast Notifications**: svelte-sonner
- **Theme**: Light/Dark mode with CSS variables

### Additional Libraries

#### Charts & Visualization
- **TODO**: Add Svelte 5 compatible charting library (chart.js/svelte-chartjs removed - not compatible with Svelte 5)

#### Calendar & Scheduling
- **TODO**: Add Svelte 5 compatible calendar library (FullCalendar removed - no Svelte 5 adapter)

#### Drag & Drop (Kanban)
- **svelte-dnd-action** - Drag-and-drop for kanban boards

#### Document Generation
- **jsPDF** or **@pdfme/generator** - PDF generation for offers/reports
- **SheetJS (xlsx)** - Excel import/export for reports

#### API Communication
- **Native fetch API** - HTTP client for all API calls

#### Financial Calculations
- **Custom currency utilities** - `src/lib/utils/currency.ts` (dinero.js removed - import issues with Svelte 5)
- **date-fns** - Date manipulation and formatting

#### File Storage
- **Custom server** - Files stored on own server (receipts, documents, PDFs)

#### Email
- **Nodemailer** - Send offers and notifications

### Development Tools
- **IDE**: WebStorm
- **Package Manager**: npm or pnpm
- **Linting**: ESLint + Prettier
- **Type Checking**: TypeScript strict mode
- **Git**: Version control with conventional commits

### Infrastructure
- **Development Database**: Docker Compose (PostgreSQL)
- **File Storage**: Own server (receipts, documents, PDFs)
- **Deployment**: Own server with GitHub for version control
- **CI/CD**: GitHub Actions (optional) for automated deployment

### Environment Variables

**Required Environment Variables**:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Auth.js
NEXTAUTH_URL="http://localhost:5173"
NEXTAUTH_SECRET="generate-a-secure-random-string"

# File Storage
UPLOAD_DIR="/var/uploads"
MAX_FILE_SIZE="10485760" # 10MB in bytes

# SMTP Configuration (Nodemailer)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false" # true for port 465
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="noreply@yourcompany.com"

# Application
NODE_ENV="development" # or "production"
PORT="5173"

# Optional
ALLOWED_ORIGINS="http://localhost:5173,https://yourdomain.com"
```

---

## Architecture

### Project Structure

```
company-management/
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/             # Database migrations
│   └── seed.ts                 # Seed data for development
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ui/            # shadcn-svelte components
│   │   │   ├── layout/        # Layout components (Sidebar, Header, etc.)
│   │   │   ├── forms/         # Reusable form components
│   │   │   ├── tables/        # Reusable table components
│   │   │   └── shared/        # Shared components (DataTable, StatusBadge, etc.)
│   │   ├── modules/
│   │   │   ├── clients/
│   │   │   │   ├── components/
│   │   │   │   ├── schemas.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── utils.ts
│   │   │   ├── projects/
│   │   │   ├── employees/
│   │   │   ├── finances/
│   │   │   ├── offers/
│   │   │   └── pricelists/
│   │   ├── server/
│   │   │   ├── prisma.ts      # Prisma client with middleware
│   │   │   ├── access-control.ts
│   │   │   ├── audit.ts       # Audit logging utilities
│   │   │   └── email.ts       # Email utilities
│   │   ├── stores/
│   │   │   ├── theme.ts       # Theme store (light/dark)
│   │   │   └── user.ts        # User state
│   │   ├── config/
│   │   │   └── modules.ts     # Module registry
│   │   └── utils/
│   │       ├── currency.ts    # Money formatting utilities
│   │       ├── date.ts        # Date utilities
│   │       └── validation.ts  # Shared validation helpers
│   ├── routes/
│   │   ├── (auth)/            # Public authentication routes
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (app)/             # Protected application routes
│   │   │   ├── +layout.svelte
│   │   │   ├── +layout.server.ts
│   │   │   ├── dashboard/
│   │   │   ├── clients/
│   │   │   │   ├── +page.svelte           # List view
│   │   │   │   ├── +page.server.ts
│   │   │   │   ├── new/                   # Create
│   │   │   │   ├── [id]/                  # Detail view
│   │   │   │   └── [id]/edit/             # Edit
│   │   │   ├── projects/
│   │   │   ├── employees/
│   │   │   ├── finances/
│   │   │   │   ├── income/
│   │   │   │   ├── expenses/
│   │   │   │   └── payments/
│   │   │   ├── offers/
│   │   │   ├── pricelists/
│   │   │   └── settings/
│   │   └── api/               # API routes (if needed)
│   ├── hooks.server.ts        # SvelteKit server hooks (auth, etc.)
│   ├── app.html
│   └── app.css
├── static/
├── docker-compose.yml         # PostgreSQL for development
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── svelte.config.js
└── CLAUDE.md                  # This file
```

### Design Patterns

#### 0. Person-Centric Contact Management
The Person model serves as the central repository for all contact information across the system:

**Person Types:**
- `company_employee` - Employees of your company
    - Can have optional User account for system access
    - Includes employment details (hire date, salary, department, etc.)
    - Can be assigned to projects and tasks
    - Can be project managers

- `client_contact` - Contact persons at client companies
    - Multiple contacts per client
    - One can be marked as primary contact
    - No User account (external persons)

- `vendor_contact` - Contact persons at vendor companies
    - Multiple contacts per vendor
    - No User account (external persons)

**Benefits:**
- Consistent contact data structure across all entities
- Easy to search/filter all contacts in one place
- Prevents data duplication
- Simplifies reports across clients, vendors, and employees
- Clear separation between Person (contact data) and User (system access)

**User vs Person:**
- **Person**: Physical person with contact details (may or may not use the system)
- **User**: System account with login credentials and permissions
- Company employees can have both (Person + User)
- Client/vendor contacts only have Person records (no system access)

#### 1. Authentication Flow
- All routes under `(app)` require authentication
- Unauthenticated users redirected to `/login`
- Session stored in database via Prisma adapter
- User permissions loaded in root layout

#### 2. Access Control Pattern
```typescript
// In +page.server.ts
export const load = async ({ locals }) => {
  await requirePermission(locals, 'clients', 'read');
  // Load data
};

export const actions = {
  create: async ({ locals, request }) => {
    await requirePermission(locals, 'clients', 'create');
    // Create logic
    await logAction(locals.user.id, 'created', 'clients', newClient.id);
  }
};
```

#### 3. Soft Delete Pattern
- All models have `deletedAt: DateTime?` field
- Prisma middleware intercepts delete operations
- Queries automatically filter out soft-deleted records
- Admin interface can view/restore deleted records

#### 4. Audit Logging Pattern
- Log after successful mutations (create, update, delete)
- Capture old/new values for updates
- Include user, timestamp, IP, user agent
- Queryable audit trail in admin interface

#### 5. Module Pattern
- Each module is self-contained
- Registered in `modules.ts` config
- Consistent CRUD routes structure
- Reusable components from shared library

#### 6. Form Handling Pattern
```svelte
<script lang="ts">
  import { superForm } from 'sveltekit-superforms/client';
  export let data;
  
  const { form, errors, enhance } = superForm(data.form);
</script>

<form method="POST" use:enhance>
  <!-- Form fields with error handling -->
</form>
```

---

## Core Architectural Rules

### 1. Authentication & Authorization

#### Rules
- **Only registered users** can access the application
- **All routes under `(app)`** require authentication
- **No guest access** - redirect to login immediately
- **Session-based auth** with database persistence

#### Implementation Checklist
- [ ] Configure Auth.js with Prisma adapter
- [ ] Create `hooks.server.ts` with authentication check
- [ ] Protect all `(app)` routes
- [ ] Create login/register pages
- [ ] Set up session management

### 2. Role-Based Access Control (RBAC)

#### Rules
- **Permissions are module + action based**: `module.action` (e.g., `clients.read`, `finances.update`)
- **Users belong to UserGroups**: One user can be in multiple groups
- **UserGroups have Permissions**: Permissions are assigned to groups, not individual users
- **Check permissions before every sensitive operation**: Load, create, update, delete, export
- **UI adapts to permissions**: Hide/disable features user can't access

#### Permission Naming Convention
```
{module}.{action}
Examples:
- clients.read
- clients.create
- clients.update
- clients.delete
- clients.export
- finances.income.read
- finances.expenses.create
```

#### Default User Groups
```
Admin: All permissions
Manager: Read all, write to clients/projects/offers, read finances
Accountant: Full finances access, read-only on clients/projects
Employee: Read clients/projects, limited finances view
```

#### Implementation Checklist
- [ ] Create User, UserGroup, Permission models
- [ ] Seed default groups and permissions
- [ ] Create `checkPermission()` utility
- [ ] Create `requirePermission()` middleware
- [ ] Filter navigation based on permissions
- [ ] Add permission checks to all server actions

### 3. Soft Delete

#### Rules
- **Never hard delete records** - always use soft delete
- **All models must have `deletedAt: DateTime?`** field
- **Prisma middleware intercepts deletes** and converts to updates
- **Queries auto-filter soft-deleted records** unless explicitly included
- **Admin can view/restore deleted records** in settings

#### Implementation Checklist
- [ ] Add `deletedAt` to all models
- [ ] Implement Prisma soft-delete middleware
- [ ] Create restore functionality (admin only)
- [ ] Add "include deleted" option for admin views

### 4. Audit Logging

#### Rules
- **Log all important user actions**: Create, update, delete, export, login attempts
- **Capture context**: User ID, timestamp, IP address, user agent
- **Store old/new values** for updates (as JSON)
- **Make audit logs queryable** but not editable
- **Audit logs are never deleted** (even soft-delete doesn't apply)

#### Actions to Log
- User login/logout
- Create/update/delete operations on all entities
- Permission changes
- Exports (reports, Excel files)
- Password changes
- Failed authentication attempts

#### Implementation Checklist
- [ ] Create AuditLog model
- [ ] Create `logAction()` utility
- [ ] Add logging to all mutations
- [ ] Create audit log viewer (admin only)
- [ ] Add filtering/search to audit logs

### 5. Scalable Module System

#### Rules
- **Modules are self-contained**: Each has its own components, schemas, types
- **Register modules in `modules.ts`**: Single source of truth
- **Consistent CRUD structure**: `/module`, `/module/new`, `/module/[id]`, `/module/[id]/edit`
- **Modules define their permissions**: Listed in module config
- **Easy to add new modules**: Follow the template pattern

#### Module Definition
```typescript
interface Module {
  id: string;              // Unique identifier
  name: string;            // Display name
  icon: string;            // Lucide icon name
  route: string;           // Base route
  permissions: string[];   // Required permissions to view
  subModules?: Module[];   // Optional sub-navigation
}
```

#### Implementation Checklist
- [ ] Create module registry in `config/modules.ts`
- [ ] Build navigation from module registry
- [ ] Create module template/starter
- [ ] Document module creation process

### 6. Consistent UI/UX

#### Rules
- **Use shadcn-svelte components** for all UI elements
- **Follow design system**: Colors, spacing, typography from Tailwind config
- **Reuse components**: Don't duplicate - extract to shared components
- **Consistent patterns**: Same layout for all CRUD operations
- **Accessible**: Proper ARIA labels, keyboard navigation
- **Person management**: Consistent contact card/list components for all Person types

#### Component Hierarchy
```
Layout Components (src/lib/components/layout/)
- AppShell.svelte
- Sidebar.svelte
- Header.svelte
- Breadcrumbs.svelte

Shared Components (src/lib/components/shared/)
- DataTable.svelte
- PageHeader.svelte
- EmptyState.svelte
- ConfirmDialog.svelte
- StatusBadge.svelte
- FormField.svelte
- PersonCard.svelte (display person contact info)
- PersonList.svelte (list of persons with type badges)
- PersonForm.svelte (reusable person create/edit form)

UI Primitives (src/lib/components/ui/)
- button.svelte
- input.svelte
- select.svelte
- dialog.svelte
- [all shadcn components]
```

#### Implementation Checklist
- [ ] Install and configure shadcn-svelte
- [ ] Create layout components
- [ ] Create shared components library
- [ ] Document component usage
- [ ] Create Storybook (optional)

### 7. CRUD Consistency

#### Rules
- **Standard route structure** for all resources
- **Consistent layouts** using `CrudLayout.svelte`
- **Superforms for validation** on all forms
- **Optimistic UI updates** where appropriate
- **Confirmation dialogs** for destructive actions

#### Standard CRUD Routes
```
List:   /module
Create: /module/new
View:   /module/[id]
Edit:   /module/[id]/edit
Delete: POST /module/[id] (with confirmation)
```

#### Standard CRUD Components
- List view: Table with search, sort, filter, pagination
- Create/Edit: Form with validation and error handling
- View: Read-only detail page with action buttons
- Delete: Confirmation dialog before soft-delete

#### Implementation Checklist
- [ ] Create `CrudLayout.svelte` base component
- [ ] Create form templates
- [ ] Create table templates
- [ ] Set up Superforms schemas
- [ ] Build first module as reference

### 8. Theme Support

#### Rules
- **Support light and dark mode**
- **User preference persisted** in localStorage
- **System preference detection** as default
- **Smooth transitions** between themes
- **Consistent colors** using CSS variables

#### Implementation Checklist
- [ ] Configure Tailwind for dark mode
- [ ] Create theme store
- [ ] Create theme toggle component
- [ ] Add theme switcher to header
- [ ] Test all components in both modes

### 9. Navigation

#### Rules
- **Sidebar navigation** for main modules
- **Breadcrumbs** for current location
- **Responsive mobile menu** (hamburger)
- **Navigation filtered by permissions**
- **Active state** for current route
- **Collapsible sections** for sub-modules

#### Implementation Checklist
- [ ] Build sidebar component with module registry
- [ ] Create breadcrumb component
- [ ] Add mobile responsive menu
- [ ] Filter navigation by user permissions
- [ ] Add search/command palette (optional)

---

## Module Definitions

### Module 1: Clients

#### Purpose
Manage company clients/customers with contact information, projects, and financial history. Clients can have multiple contact persons managed through the Person model.

#### Permissions
- `clients.read` - View client list and details
- `clients.create` - Create new clients
- `clients.update` - Edit client information
- `clients.delete` - Soft-delete clients
- `clients.export` - Export client data
- `clients.contacts` - Manage client contact persons

#### Features
- Client list with search and filtering
- Client detail page with:
    - Company information
    - Contact persons (linked Person records)
    - Associated projects
    - Income history
    - Payment history
    - Offers sent
- Create/edit forms with validation
- Client status tracking (active, inactive, archived)
- Manage multiple contact persons per client
- Notes and attachments

#### Data Fields
**Client Company:**
- Name (required)
- Company name
- Primary email
- Primary phone
- Address (street, city, postal code, country)
- Tax ID / VAT number
- Website
- Industry
- Status (active/inactive)
- Payment terms (days)
- Currency preference
- Notes
- Created/updated timestamps
- Created by user

**Client Contacts (Person records):**
- Managed through Person model with `personType = "client_contact"`
- Multiple contacts per client
- One can be marked as primary contact

---

### Module 2: Employees

#### Purpose
Manage company employees through the Person model. Employees are Person records with `personType = "company_employee"` and can optionally have User accounts for system access.

#### Permissions
- `employees.read` - View employee list and details
- `employees.create` - Add new employees
- `employees.update` - Edit employee information
- `employees.delete` - Soft-delete employees
- `employees.permissions` - Manage employee permissions/groups (requires User account)
- `employees.salary` - View/edit salary information (restricted)

#### Features
- Employee directory with search
- Employee profiles with:
    - Personal information (from Person model)
    - Role and department
    - User account (optional - for system access)
    - User group assignments (if has User account)
    - Project assignments
    - Salary information (restricted)
    - Contact details
- Create User accounts for employees who need system access
- User group management
- Permission assignment
- Employee status (active, on leave, terminated)

#### Data Fields
**Person Record (personType = "company_employee"):**
- First name, last name (required)
- Email
- Phone, mobile
- Address
- Date of birth
- Hire date
- Employment type (full-time, part-time, contractor)
- Department
- Job title / position
- Salary (encrypted, restricted access)
- Employee status (active, inactive)
- Emergency contact
- Notes
- Created/updated timestamps

**Optional User Account:**
- Linked via userId in Person model
- Only created if employee needs system access
- Email (from Person record)
- User groups assignment
- Permissions through groups

---

### Module 3: Vendors

#### Purpose
Manage vendors/suppliers who provide goods or services to the company. Vendors can have multiple contact persons managed through the Person model.

#### Permissions
- `vendors.read` - View vendor list and details
- `vendors.create` - Create new vendors
- `vendors.update` - Edit vendor information
- `vendors.delete` - Soft-delete vendors
- `vendors.export` - Export vendor data
- `vendors.contacts` - Manage vendor contact persons

#### Features
- Vendor list with search and filtering
- Vendor detail page with:
    - Company information
    - Contact persons (linked Person records)
    - Expense history
    - Payment history
    - Vendor category
- Create/edit forms with validation
- Vendor status tracking (active, inactive)
- Manage multiple contact persons per vendor
- Notes and attachments

#### Data Fields
**Vendor Company:**
- Name (required)
- Company name
- Primary email
- Primary phone
- Address (street, city, postal code, country)
- Tax ID / VAT number
- Website
- Category (supplier, contractor, service provider, etc.)
- Status (active/inactive)
- Payment terms (days)
- Currency preference
- Notes
- Created/updated timestamps

**Vendor Contacts (Person records):**
- Managed through Person model with `personType = "vendor_contact"`
- Multiple contacts per vendor
- Contact details and position

---

### Module 4: Projects

#### Purpose
Manage projects, track progress, assign employees, link to clients, and monitor finances.

#### Permissions
- `projects.read` - View project list and details
- `projects.create` - Create new projects
- `projects.update` - Edit project information
- `projects.delete` - Soft-delete projects
- `projects.tasks` - Manage project tasks (kanban)

#### Features
- Project list with status filtering
- Project dashboard with:
    - Overview (status, timeline, budget)
    - Assigned employees
    - Tasks (kanban board)
    - Income/expenses linked to project
    - Documents and files
    - Timeline/calendar view
- Project status tracking (planning, active, on-hold, completed, cancelled)
- Budget vs actual tracking
- Gantt chart (optional)

#### Data Fields
- Name (required)
- Description
- Client (required, foreign key)
- Status (enum)
- Start date
- End date (estimated)
- Budget (estimated)
- Actual cost (calculated from expenses)
- Actual income (calculated from income records)
- Priority (low, medium, high)
- Assigned employees (many-to-many)
- Project manager (foreign key to employee)
- Tags/categories
- Notes
- Created/updated timestamps

---

### Module 5: Finances - Income

#### Purpose
Track all money coming into the company from clients, projects, and other sources.

#### Permissions
- `finances.income.read` - View income records
- `finances.income.create` - Record new income
- `finances.income.update` - Edit income records
- `finances.income.delete` - Soft-delete income records
- `finances.income.export` - Export income reports

#### Features
- Income list with filtering (date range, client, project, category)
- Income dashboard with:
    - Total income by period
    - Income by client
    - Income by project
    - Income by category
    - Charts and trends
- Create/edit income records
- Link income to clients, projects, payments
- Recurring income templates (optional)

#### Data Fields
- Amount (required, Decimal)
- Currency (default from settings)
- Date (required)
- Description (required)
- Category (dropdown: project_payment, consulting, product_sale, other)
- Client (optional, foreign key)
- Project (optional, foreign key)
- Payment (optional, foreign key - link to payment record)
- Invoice reference (text field)
- Tax rate / VAT
- Notes
- Created by user
- Created/updated timestamps

---

### Module 6: Finances - Expenses

#### Purpose
Track all money going out of the company for operations, salaries, vendors, etc.

#### Permissions
- `finances.expenses.read` - View expense records
- `finances.expenses.create` - Record new expenses
- `finances.expenses.update` - Edit expense records
- `finances.expenses.delete` - Soft-delete expense records
- `finances.expenses.export` - Export expense reports

#### Features
- Expense list with filtering (date range, category, project)
- Expense dashboard with:
    - Total expenses by period
    - Expenses by category
    - Expenses by project
    - Charts and trends
- Create/edit expense records
- Upload receipts (file attachments)
- Link expenses to projects
- Recurring expense templates (optional)

#### Data Fields
- Amount (required, Decimal)
- Currency
- Date (required)
- Description (required)
- Category (dropdown: salary, software, office, marketing, travel, equipment, contractor, other)
- Project (optional, foreign key - project-specific costs)
- Vendor (optional, foreign key - link to vendor)
- Payment (optional, foreign key - link to payment record)
- Receipt file path (stored on own server)
- Tax deductible (boolean)
- Notes
- Created by user
- Created/updated timestamps

---

### Module 7: Finances - Payments

#### Purpose
Track actual payment transactions (money in/out) and link them to income/expense records.

#### Permissions
- `finances.payments.read` - View payment records
- `finances.payments.create` - Record new payments
- `finances.payments.update` - Edit payment records
- `finances.payments.delete` - Soft-delete payment records
- `finances.payments.reconcile` - Mark payments as reconciled

#### Features
- Payment list with filtering (date, type, status, client)
- Payment dashboard with:
    - Cash flow (payments in vs out)
    - Outstanding payments
    - Payment methods breakdown
    - Reconciliation status
- Create/edit payment records
- Link payments to income/expenses
- Payment reconciliation (mark as cleared in bank)
- Expected vs actual payment dates

#### Data Fields
- Amount (required, Decimal)
- Currency
- Date (required)
- Type (enum: received, paid)
- Method (enum: bank_transfer, cash, credit_card, check, other)
- Status (enum: pending, completed, failed, cancelled)
- Client (optional, foreign key - if payment from/to client)
- Income (optional, foreign key)
- Expense (optional, foreign key)
- Reference number (bank transaction ID, check number, etc.)
- Expected date (for pending payments)
- Reconciled (boolean)
- Reconciled date
- Notes
- Created by user
- Created/updated timestamps

---

### Module 8: Price Lists

#### Purpose
Manage product/service catalogs with prices for creating offers and tracking income.

#### Permissions
- `pricelists.read` - View price lists
- `pricelists.create` - Create new items
- `pricelists.update` - Edit prices and items
- `pricelists.delete` - Soft-delete items
- `pricelists.history` - View price history

#### Features
- Price list catalog with search
- Categories/tags for organization
- Price history tracking
- Create/edit items
- Bulk import/export (Excel)
- Currency management
- Discount/markup rules (optional)

#### Data Fields
- Name (required)
- Description
- SKU/code (unique)
- Category
- Unit price (required, Decimal)
- Currency
- Unit of measure (hour, piece, project, etc.)
- Tax rate / VAT
- Active (boolean)
- Valid from date
- Valid to date
- Notes
- Created/updated timestamps

---

### Module 9: Offers

#### Purpose
Create and send professional offers/quotes to clients, track status, convert to projects.

#### Permissions
- `offers.read` - View offers
- `offers.create` - Create new offers
- `offers.update` - Edit offers
- `offers.delete` - Soft-delete offers
- `offers.send` - Send offers via email
- `offers.convert` - Convert offers to projects

#### Features
- Offer list with status filtering
- Create offers with:
    - Client selection
    - Line items (from price list or custom)
    - Quantity, price, tax
    - Terms and conditions
    - Validity period
- Generate PDF
- Send via email
- Track status (draft, sent, accepted, rejected, expired)
- Convert accepted offers to projects
- Offer templates

#### Data Fields
- Offer number (auto-generated, unique)
- Date (required)
- Client (required, foreign key)
- Status (enum: draft, sent, accepted, rejected, expired)
- Valid until date
- Line items (JSON or separate table):
    - Item name
    - Description
    - Quantity
    - Unit price
    - Tax rate
    - Total
- Subtotal (calculated)
- Tax total (calculated)
- Grand total (calculated)
- Currency
- Terms and conditions (text)
- Notes (internal)
- PDF URL (generated)
- Sent date
- Accepted/rejected date
- Converted to project (foreign key, optional)
- Created by user
- Created/updated timestamps

---

### Module 10: Dashboard

#### Purpose
Provide high-level overview of company status, key metrics, and quick actions.

#### Permissions
- `dashboard.read` - View dashboard (all authenticated users)
- `dashboard.finances` - View financial widgets (restricted)

#### Features
- Key metrics cards:
    - Total income (this month/year)
    - Total expenses (this month/year)
    - Net profit (income - expenses)
    - Outstanding payments
    - Active projects count
    - Active clients count
- Charts:
    - Cash flow over time (income vs expenses)
    - Income by client (top 10)
    - Expenses by category
    - Project status distribution
- Recent activity feed:
    - Latest income/expenses
    - New clients
    - New projects
    - Offer status changes
- Quick actions:
    - Record income/expense
    - Create offer
    - Add client
    - Start project
- Widgets personalized by user role

---

### Module 11: Settings

#### Purpose
Application configuration, user management, system settings.

#### Permissions
- `settings.read` - View settings
- `settings.company` - Edit company information
- `settings.users` - Manage users and permissions
- `settings.system` - System-wide settings (admin only)

#### Features
- Company profile:
    - Company name, logo
    - Address, contact info
    - Tax ID, VAT number
    - Default currency
    - Email templates
- User management:
    - Create/edit users
    - Assign user groups
    - Deactivate users
- User group management:
    - Create/edit groups
    - Assign permissions
- Audit log viewer (admin only)
- Deleted records viewer (admin only)
- System settings:
    - Date/time format
    - Number format
    - Fiscal year start
    - Email configuration
- Import/export tools

---

## Database Schema

### Complete Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// AUTHENTICATION & AUTHORIZATION
// ============================================================================

model User {
  id            String          @id @default(cuid())
  email         String          @unique
  emailVerified DateTime?
  password      String          // Hashed
  name          String
  image         String?
  
  // Relations
  accounts      Account[]
  sessions      Session[]
  userGroups    UserGroupUser[]
  
  // Audit trail
  auditLogs     AuditLog[]
  createdIncome     Income[]    @relation("CreatedBy")
  createdExpenses   Expense[]   @relation("CreatedBy")
  createdPayments   Payment[]   @relation("CreatedBy")
  createdClients    Client[]    @relation("CreatedBy")
  createdProjects   Project[]   @relation("CreatedBy")
  createdOffers     Offer[]     @relation("CreatedBy")
  
  // Person profile (if user is linked to a person record)
  person        Person?
  
  // Soft delete
  deletedAt     DateTime?
  
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  
  @@index([email])
}

// Auth.js required models
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model UserGroup {
  id          String              @id @default(cuid())
  name        String              @unique
  description String?
  
  users       UserGroupUser[]
  permissions GroupPermission[]
  
  deletedAt   DateTime?
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  
  @@index([name])
}

model UserGroupUser {
  userId      String
  userGroupId String
  
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userGroup   UserGroup @relation(fields: [userGroupId], references: [id], onDelete: Cascade)
  
  assignedAt  DateTime  @default(now())
  
  @@id([userId, userGroupId])
}

model Permission {
  id          String              @id @default(cuid())
  module      String              // e.g., "clients", "finances.income"
  action      String              // e.g., "read", "create", "update", "delete"
  description String?
  
  groups      GroupPermission[]
  
  deletedAt   DateTime?
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  
  @@unique([module, action])
  @@index([module, action])
}

model GroupPermission {
  userGroupId  String
  permissionId String
  
  userGroup    UserGroup  @relation(fields: [userGroupId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  
  grantedAt    DateTime   @default(now())
  
  @@id([userGroupId, permissionId])
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  
  action     String   // "created", "updated", "deleted", "exported", "login", etc.
  module     String   // "clients", "projects", "finances", etc.
  entityId   String?  // ID of the affected record
  entityType String?  // "Client", "Project", "Income", etc.
  
  oldValues  Json?    // Previous state (for updates)
  newValues  Json?    // New state (for creates/updates)
  
  ipAddress  String?
  userAgent  String?
  
  createdAt  DateTime @default(now())
  
  @@index([userId, createdAt])
  @@index([module, entityId])
  @@index([createdAt])
}

// ============================================================================
// COMPANY & EMPLOYEES
// ============================================================================

model Company {
  id          String   @id @default(cuid())
  name        String
  legalName   String?
  taxId       String?
  vatNumber   String?
  
  // Address
  street      String?
  city        String?
  postalCode  String?
  country     String?
  
  // Contact
  email       String?
  phone       String?
  website     String?
  
  // Settings
  logo        String?
  currency    String   @default("USD")
  fiscalYearStart Int  @default(1) // Month (1-12)
  
  // Relations
  clients     Client[]
  projects    Project[]
  employees   Person[]  @relation("CompanyEmployees")
  
  deletedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

// ============================================================================
// PERSON MODEL - Central contact management
// ============================================================================

model Person {
  id              String    @id @default(cuid())
  
  // Basic Information
  firstName       String
  lastName        String
  email           String?
  phone           String?
  mobile          String?
  dateOfBirth     DateTime?
  
  // Address
  street          String?
  city            String?
  postalCode      String?
  country         String?
  
  // Person Type & Relations
  personType      String    // "company_employee", "client_contact", "vendor_contact"
  
  // Company Employee (if personType = "company_employee")
  companyId       String?
  company         Company?  @relation("CompanyEmployees", fields: [companyId], references: [id])
  userId          String?   @unique
  user            User?     @relation(fields: [userId], references: [id])
  hireDate        DateTime?
  employmentType  String?   // "full-time", "part-time", "contractor"
  department      String?
  jobTitle        String?
  salary          Decimal?  @db.Decimal(10, 2) // Encrypted in app, restricted access
  employeeStatus  String?   // "active", "on_leave", "terminated"
  
  // Client Contact (if personType = "client_contact")
  clientId        String?
  client          Client?   @relation(fields: [clientId], references: [id])
  isPrimaryContact Boolean  @default(false)
  
  // Vendor Contact (if personType = "vendor_contact")
  vendorId        String?
  vendor          Vendor?   @relation(fields: [vendorId], references: [id])
  
  // Additional Info
  position        String?   // Job position/title (for all types)
  notes           String?
  emergencyContact String?
  
  // Relations
  managedProjects Project[] @relation("ProjectManager")
  assignedProjects ProjectEmployee[]
  
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([email])
  @@index([personType])
  @@index([companyId])
  @@index([clientId])
  @@index([vendorId])
  @@index([userId])
}

// ============================================================================
// CLIENTS
// ============================================================================

model Client {
  id              String    @id @default(cuid())
  companyId       String
  company         Company   @relation(fields: [companyId], references: [id])
  
  name            String
  companyName     String?
  
  // Address
  street          String?
  city            String?
  postalCode      String?
  country         String?
  
  // Business info
  taxId           String?
  vatNumber       String?
  website         String?
  industry        String?
  
  // Contact - Primary contact info (can also be in Person records)
  email           String?
  phone           String?
  
  // Settings
  status          String    @default("active") // "active", "inactive", "archived"
  paymentTerms    Int       @default(30) // Days
  currency        String    @default("USD")
  
  notes           String?
  
  // Relations
  contacts        Person[]  // Client contacts/employees
  projects        Project[]
  income          Income[]
  payments        Payment[]
  offers          Offer[]
  
  createdById     String
  createdBy       User      @relation("CreatedBy", fields: [createdById], references: [id])
  
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([companyId])
  @@index([email])
  @@index([status])
}

// ============================================================================
// VENDORS
// ============================================================================

model Vendor {
  id              String    @id @default(cuid())
  
  name            String
  companyName     String?
  
  // Address
  street          String?
  city            String?
  postalCode      String?
  country         String?
  
  // Business info
  taxId           String?
  vatNumber       String?
  website         String?
  
  // Contact - Primary contact info (can also be in Person records)
  email           String?
  phone           String?
  
  // Settings
  status          String    @default("active") // "active", "inactive"
  paymentTerms    Int       @default(30) // Days
  currency        String    @default("USD")
  
  category        String?   // Type of vendor (supplier, contractor, service provider, etc.)
  
  notes           String?
  
  // Relations
  contacts        Person[]  // Vendor contacts/employees
  expenses        Expense[]
  
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([email])
  @@index([status])
  @@index([category])
}

// ============================================================================
// PROJECTS
// ============================================================================

model Project {
  id              String    @id @default(cuid())
  companyId       String
  company         Company   @relation(fields: [companyId], references: [id])
  
  name            String
  description     String?
  
  clientId        String
  client          Client    @relation(fields: [clientId], references: [id])
  
  status          String    @default("planning") // "planning", "active", "on_hold", "completed", "cancelled"
  priority        String    @default("medium") // "low", "medium", "high"
  
  startDate       DateTime?
  endDate         DateTime?
  
  // Budget
  budgetEstimate  Decimal?  @db.Decimal(10, 2)
  
  // Calculated fields (via relations)
  // actualCost = sum of related expenses
  // actualIncome = sum of related income
  
  // Relations
  projectManagerId String?
  projectManager   Person? @relation("ProjectManager", fields: [projectManagerId], references: [id])
  
  assignedEmployees ProjectEmployee[]
  tasks            Task[]
  income           Income[]
  expenses         Expense[]
  
  tags             String[] // Array of tags
  notes            String?
  
  createdById      String
  createdBy        User     @relation("CreatedBy", fields: [createdById], references: [id])
  
  deletedAt        DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  @@index([companyId])
  @@index([clientId])
  @@index([status])
}

model ProjectEmployee {
  projectId   String
  personId    String
  
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  person      Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
  
  role        String?  // Role in this project
  assignedAt  DateTime @default(now())
  
  @@id([projectId, personId])
}

model Task {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  title       String
  description String?
  status      String   @default("todo") // "todo", "in_progress", "review", "done"
  priority    String   @default("medium")
  
  assignedTo  String?  // Employee ID
  dueDate     DateTime?
  
  order       Int      // For kanban column ordering
  column      String   @default("todo") // Kanban column
  
  deletedAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([projectId])
  @@index([status])
}

// ============================================================================
// FINANCES
// ============================================================================

model Income {
  id              String    @id @default(cuid())
  
  amount          Decimal   @db.Decimal(10, 2)
  currency        String    @default("USD")
  date            DateTime
  description     String
  
  category        String    // "project_payment", "consulting", "product_sale", "other"
  
  // Relations
  clientId        String?
  client          Client?   @relation(fields: [clientId], references: [id])
  
  projectId       String?
  project         Project?  @relation(fields: [projectId], references: [id])
  
  paymentId       String?   @unique
  payment         Payment?  @relation(fields: [paymentId], references: [id])
  
  invoiceReference String?  // External invoice number/reference
  taxRate         Decimal?  @db.Decimal(5, 2)
  
  notes           String?
  
  createdById     String
  createdBy       User      @relation("CreatedBy", fields: [createdById], references: [id])
  
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([date])
  @@index([clientId])
  @@index([projectId])
  @@index([category])
}

model Expense {
  id              String    @id @default(cuid())
  
  amount          Decimal   @db.Decimal(10, 2)
  currency        String    @default("USD")
  date            DateTime
  description     String
  
  category        String    // "salary", "software", "office", "marketing", "travel", "equipment", "contractor", "other"
  
  // Relations
  projectId       String?
  project         Project?  @relation(fields: [projectId], references: [id])
  
  vendorId        String?
  vendor          Vendor?   @relation(fields: [vendorId], references: [id])
  
  paymentId       String?   @unique
  payment         Payment?  @relation(fields: [paymentId], references: [id])
  
  receiptPath     String?   // File path on own server
  
  taxDeductible   Boolean   @default(true)
  
  notes           String?
  
  createdById     String
  createdBy       User      @relation("CreatedBy", fields: [createdById], references: [id])
  
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([date])
  @@index([projectId])
  @@index([vendorId])
  @@index([category])
}

model Payment {
  id              String    @id @default(cuid())
  
  amount          Decimal   @db.Decimal(10, 2)
  currency        String    @default("USD")
  date            DateTime
  
  type            String    // "received", "paid"
  method          String    // "bank_transfer", "cash", "credit_card", "check", "other"
  status          String    // "pending", "completed", "failed", "cancelled"
  
  // Relations
  clientId        String?
  client          Client?   @relation(fields: [clientId], references: [id])
  
  income          Income?
  expense         Expense?
  
  referenceNumber String?   // Bank transaction ID, check number, etc.
  expectedDate    DateTime? // For pending payments
  
  reconciled      Boolean   @default(false)
  reconciledDate  DateTime?
  
  notes           String?
  
  createdById     String
  createdBy       User      @relation("CreatedBy", fields: [createdById], references: [id])
  
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([date])
  @@index([type])
  @@index([status])
  @@index([clientId])
}

// ============================================================================
// PRICE LISTS
// ============================================================================

model PriceListItem {
  id              String    @id @default(cuid())
  
  name            String
  description     String?
  sku             String?   @unique
  category        String?
  
  unitPrice       Decimal   @db.Decimal(10, 2)
  currency        String    @default("USD")
  unitOfMeasure   String    @default("piece") // "hour", "piece", "project", "day", etc.
  
  taxRate         Decimal?  @db.Decimal(5, 2)
  
  active          Boolean   @default(true)
  validFrom       DateTime?
  validTo         DateTime?
  
  // Relations
  offerItems      OfferItem[]
  
  notes           String?
  deletedAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([active])
  @@index([category])
}

// ============================================================================
// OFFERS
// ============================================================================

model Offer {
  id              String      @id @default(cuid())
  offerNumber     String      @unique // Auto-generated
  
  date            DateTime    @default(now())
  validUntil      DateTime
  
  clientId        String
  client          Client      @relation(fields: [clientId], references: [id])
  
  status          String      @default("draft") // "draft", "sent", "accepted", "rejected", "expired"
  
  // Financials
  currency        String      @default("USD")
  subtotal        Decimal     @db.Decimal(10, 2)
  taxTotal        Decimal     @db.Decimal(10, 2)
  grandTotal      Decimal     @db.Decimal(10, 2)
  
  // Relations
  items           OfferItem[]
  
  // Content
  terms           String?     @db.Text // Terms and conditions
  notes           String?     // Internal notes
  
  // PDF
  pdfUrl          String?
  
  // Status tracking
  sentDate        DateTime?
  acceptedDate    DateTime?
  rejectedDate    DateTime?
  
  // Conversion
  convertedToProjectId String?
  
  createdById     String
  createdBy       User        @relation("CreatedBy", fields: [createdById], references: [id])
  
  deletedAt       DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  @@index([offerNumber])
  @@index([clientId])
  @@index([status])
}

model OfferItem {
  id              String         @id @default(cuid())
  offerId         String
  offer           Offer          @relation(fields: [offerId], references: [id], onDelete: Cascade)
  
  // Can link to price list or be custom
  priceListItemId String?
  priceListItem   PriceListItem? @relation(fields: [priceListItemId], references: [id])
  
  name            String
  description     String?
  quantity        Decimal        @db.Decimal(10, 2)
  unitPrice       Decimal        @db.Decimal(10, 2)
  taxRate         Decimal        @db.Decimal(5, 2)
  
  // Calculated: quantity * unitPrice
  subtotal        Decimal        @db.Decimal(10, 2)
  // Calculated: subtotal * (taxRate / 100)
  taxAmount       Decimal        @db.Decimal(10, 2)
  // Calculated: subtotal + taxAmount
  total           Decimal        @db.Decimal(10, 2)
  
  order           Int            // Display order
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  @@index([offerId])
}
```

### Database Relationships Summary

```
User ←→ UserGroup (many-to-many via UserGroupUser)
UserGroup ←→ Permission (many-to-many via GroupPermission)
User → Person (one-to-one, optional)
User → AuditLog (one-to-many)

Company → Client (one-to-many)
Company → Project (one-to-many)
Company → Person (one-to-many, company employees)

Person → Client (many-to-one, client contacts)
Person → Vendor (many-to-one, vendor contacts)
Person → Company (many-to-one, company employees)
Person → User (one-to-one, optional - only for company employees who need system access)

Client → Person (one-to-many, contacts)
Client → Project (one-to-many)
Client → Income (one-to-many)
Client → Payment (one-to-many)
Client → Offer (one-to-many)

Vendor → Person (one-to-many, contacts)
Vendor → Expense (one-to-many)

Project → Person (many-to-many via ProjectEmployee)
Project ← Person (project manager, one-to-many)
Project → Task (one-to-many)
Project → Income (one-to-many)
Project → Expense (one-to-many)

Income ← Payment (one-to-one)
Expense ← Payment (one-to-one)
Expense → Vendor (many-to-one)
Payment → Client (many-to-one)

Offer → Client (many-to-one)
Offer → OfferItem (one-to-many)
OfferItem → PriceListItem (many-to-one, optional)
```

---

## Development Phases (Detailed)

### Phase 0: Setup (Week 1)

**Goal**: Development environment ready

**Tasks**:
1. Initialize SvelteKit project
2. Set up Docker Compose for PostgreSQL
3. Configure Prisma
4. Install and configure TailwindCSS
5. Install shadcn-svelte components
6. Set up ESLint + Prettier
7. Configure environment variables
8. Create initial project structure
9. Set up Git repository

**Deliverables**:
- [ ] Project initialized and running
- [ ] Database connected
- [ ] Basic routing works
- [ ] TailwindCSS styling works
- [ ] shadcn components accessible

---

### Phase 1: Authentication & Base Layout (Week 2)

**Goal**: Users can log in and see basic interface

**Tasks**:
1. Set up Auth.js with Prisma adapter
2. Create User, Account, Session models
3. Build login page
4. Build register page (optional, or admin creates users)
5. Create authentication hooks in `hooks.server.ts`
6. Protect all `(app)` routes
7. Create base layout:
    - `AppShell.svelte`
    - `Sidebar.svelte`
    - `Header.svelte` with user menu
8. Create theme store and toggle
9. Add logout functionality

**Deliverables**:
- [ ] Users can register/login
- [ ] Protected routes redirect to login
- [ ] Basic app layout with sidebar
- [ ] Theme toggle (light/dark) works
- [ ] User can log out

---

### Phase 2: RBAC & Audit (Week 3)

**Goal**: Permission system and logging infrastructure

**Tasks**:
1. Create UserGroup, Permission models
2. Create many-to-many relation tables
3. Implement Prisma soft-delete middleware
4. Create AuditLog model
5. Build access control utilities:
    - `checkPermission()`
    - `requirePermission()`
6. Build audit logging utilities:
    - `logAction()`
7. Seed default user groups and permissions
8. Create permission management UI (Settings)
9. Test permission enforcement

**Deliverables**:
- [ ] User groups created with permissions
- [ ] Permissions enforced on routes
- [ ] Soft-delete works on all models
- [ ] Audit logs created for actions
- [ ] Admin can view audit logs

---

### Phase 3: Core Models - Person, Clients, Vendors (Week 4)

**Goal**: Create central Person model and complete client/vendor management

**Tasks**:
1. Create Person model (central contact management)
2. Create Client model and migrations
3. Create Vendor model and migrations
4. Build client list page with DataTable
5. Build client create form (with option to add contacts)
6. Build client edit form
7. Build client detail page (with contacts tab)
8. Build vendor list page
9. Build vendor create/edit forms
10. Build vendor detail page
11. Implement search and filtering for both
12. Add permission checks to all routes
13. Add audit logging to all mutations
14. Create reusable components:
- `CrudLayout.svelte`
- `PageHeader.svelte`
- `EmptyState.svelte`
- `ConfirmDialog.svelte`
- `ContactsList.svelte` (for displaying Person contacts)

**Deliverables**:
- [ ] Person model created
- [ ] Users can create clients with contacts
- [ ] Users can create vendors with contacts
- [ ] Users can view client/vendor lists
- [ ] Users can edit/delete clients/vendors
- [ ] Contact management works
- [ ] Search and filter work
- [ ] Permissions enforced
- [ ] Audit logs created
- [ ] Reusable components ready

---

### Phase 4: Employees Module (Week 5)

**Goal**: Employee management using Person model with optional User accounts

**Tasks**:
1. Extend Person model usage for employees (personType = "company_employee")
2. Build employee list page
3. Build employee create form (creates Person record)
4. Add option to create User account for employees needing system access
5. Build employee edit form
6. Build employee detail page with:
    - Personal information
    - Employment details
    - User account status (if linked)
    - User group assignments (if has User)
    - Project assignments
7. Add user group assignment UI (for employees with User accounts)
8. Implement employee status management
9. Add salary field (encrypted, restricted access by permission)
10. Test permissions for salary visibility
11. Link User ↔ Person for employees with system access

**Deliverables**:
- [ ] Employees (Person records) can be created
- [ ] Optional User accounts can be created for employees
- [ ] Employee directory works
- [ ] User groups can be assigned (when User exists)
- [ ] Salary field restricted properly
- [ ] Employee status tracking works
- [ ] User ↔ Person linking works

---

### Phase 5: Projects Module (Week 6)

**Goal**: Project management foundation

**Tasks**:
1. Create Project, ProjectEmployee, Task models
2. Build project list page with status filtering
3. Build project create form
4. Build project edit form
5. Build project detail page with tabs:
    - Overview
    - Team (assigned employees via Person)
    - Tasks (basic list, kanban later)
    - Finances (income/expenses, added later)
6. Implement project status workflow
7. Add client relationship and display
8. Add employee assignment (many-to-many via Person)
9. Assign project manager (Person with personType = "company_employee")

**Deliverables**:
- [ ] Projects can be created and linked to clients
- [ ] Project list with filtering works
- [ ] Employees (Person records) can be assigned to projects
- [ ] Project manager assignment works
- [ ] Project status tracking works
- [ ] Project detail page with tabs

---

### Phase 6: Finances - Income (Week 7)

**Goal**: Income tracking

**Tasks**:
1. Create Income model and migrations
2. Build income list page with filtering
3. Build income create form
4. Build income edit form
5. Add client/project linking in forms
6. Implement category dropdown
7. Add date range filtering
8. Create income summary cards (total by period)
9. Add basic chart (income over time)

**Deliverables**:
- [ ] Income records can be created
- [ ] Income linked to clients/projects
- [ ] Income list with filtering
- [ ] Basic income dashboard
- [ ] Income chart displays

---

### Phase 7: Finances - Expenses (Week 8)

**Goal**: Expense tracking with receipts and vendor management

**Tasks**:
1. Create Expense model and migrations (with vendor relation)
2. Build expense list page with filtering
3. Build expense create form
4. Build expense edit form
5. Add project linking (optional)
6. Add vendor linking (optional - select from vendors)
7. Implement category dropdown
8. Add file upload for receipts (store on own server)
9. Create file upload utility for server storage
10. Add expense summary cards
11. Add basic chart (expenses over time)
12. Add expense by vendor breakdown

**Deliverables**:
- [ ] Expense records can be created
- [ ] Expenses linked to projects (optional)
- [ ] Expenses linked to vendors (optional)
- [ ] Receipt upload to own server works
- [ ] Expense list with filtering
- [ ] Basic expense dashboard
- [ ] Expense chart displays
- [ ] Expense by vendor analytics

---

### Phase 8: Finances - Payments (Week 9)

**Goal**: Payment tracking and reconciliation

**Tasks**:
1. Create Payment model and migrations
2. Build payment list page with filtering
3. Build payment create form
4. Build payment edit form
5. Add income/expense linking
6. Implement payment status workflow
7. Add reconciliation feature
8. Add client relationship
9. Create cash flow chart (payments in/out)

**Deliverables**:
- [ ] Payment records can be created
- [ ] Payments linked to income/expenses
- [ ] Payment status tracking works
- [ ] Reconciliation feature works
- [ ] Cash flow chart displays

---

### Phase 9: Financial Dashboard (Week 10)

**Goal**: Comprehensive financial overview

**NOTE**: Chart.js/svelte-chartjs removed - not compatible with Svelte 5. Need to find/build Svelte 5 compatible charting solution.

**Tasks**:
1. Build dashboard layout with widgets
2. Create key metrics cards:
    - Total income
    - Total expenses
    - Net profit
    - Outstanding payments
3. Research and select Svelte 5 compatible charting library
4. Create charts:
    - Cash flow over time
    - Income by client (top 10)
    - Expenses by category
    - Project profitability
5. Add date range selector
6. Add filtering options
7. Optimize queries for performance
8. Add export functionality (Excel)

**Deliverables**:
- [ ] Financial dashboard displays key metrics
- [ ] Charts render correctly
- [ ] Date range filtering works
- [ ] Excel export works
- [ ] Dashboard loads quickly

---

### Phase 10: Price Lists (Week 11)

**Goal**: Product/service catalog

**Tasks**:
1. Create PriceListItem model and migrations
2. Build price list page with search
3. Build item create form
4. Build item edit form
5. Implement categories/tags
6. Add price history tracking
7. Add active/inactive toggle
8. Implement bulk import (Excel)
9. Implement bulk export (Excel)

**Deliverables**:
- [ ] Price list items can be created
- [ ] Price list searchable
- [ ] Categories work
- [ ] Import/export works
- [ ] Price history tracked

---

### Phase 11: Offers (Week 12)

**Goal**: Professional offer generation

**Tasks**:
1. Create Offer, OfferItem models and migrations
2. Build offer list page with status filtering
3. Build offer create form:
    - Client selection
    - Line items (from price list or custom)
    - Quantity, price, tax calculation
4. Build offer edit form
5. Build offer detail page
6. Implement offer number generation
7. Add PDF generation (jsPDF or @pdfme)
8. Add email sending (Nodemailer)
9. Implement status workflow (draft → sent → accepted/rejected)
10. Add "convert to project" feature

**Deliverables**:
- [ ] Offers can be created with line items
- [ ] Offer PDF generates correctly
- [ ] Offers can be sent via email
- [ ] Offer status tracking works
- [ ] Offers can be converted to projects

---

### Phase 12: Kanban Board (Week 13)

**Goal**: Visual project task management

**Tasks**:
1. Install svelte-dnd-action
2. Build kanban board component
3. Implement drag-and-drop for tasks
4. Add task create/edit modals
5. Add task assignment to employees
6. Add task status columns (todo, in progress, done)
7. Integrate kanban into project detail page
8. Add task filtering and sorting
9. Optimize for performance

**Deliverables**:
- [ ] Kanban board displays project tasks
- [ ] Drag-and-drop works smoothly
- [ ] Tasks can be created/edited
- [ ] Tasks assigned to employees
- [ ] Kanban integrated into projects

---

### Phase 13: Calendar & Timeline (Week 14)

**Goal**: Project scheduling and deadlines

**NOTE**: FullCalendar removed - not compatible with Svelte 5. Need to find/build Svelte 5 compatible calendar solution.

**Tasks**:
1. Research and select Svelte 5 compatible calendar library
2. Build calendar view component
3. Display project milestones and deadlines
4. Display task due dates
5. Add employee schedule view (optional)
6. Add timeline/Gantt chart (optional)
7. Integrate calendar into dashboard
8. Add filters (by project, employee, etc.)

**Deliverables**:
- [ ] Calendar displays project events
- [ ] Task due dates visible
- [ ] Calendar integrated into app
- [ ] Filtering works

---

### Phase 14: Settings & Admin (Week 15)

**Goal**: System configuration and management

**Tasks**:
1. Build settings page structure
2. Create company profile section
3. Create user management section
4. Create user group management section
5. Create audit log viewer (admin only)
6. Create deleted records viewer (admin only)
7. Add system settings (date format, currency, etc.)
8. Add email configuration UI
9. Test all settings functionality

**Deliverables**:
- [ ] Company profile can be edited
- [ ] Users can be managed by admin
- [ ] User groups can be configured
- [ ] Audit logs viewable
- [ ] Deleted records viewable/restorable
- [ ] System settings work

---

### Phase 15: Polish & Testing (Week 16)

**Goal**: Production-ready application

**Tasks**:
1. Comprehensive testing of all modules
2. Mobile responsiveness testing
3. Cross-browser testing
4. Performance optimization:
    - Query optimization
    - Lazy loading
    - Image optimization
5. Security audit:
    - SQL injection prevention
    - XSS prevention
    - CSRF protection
6. Accessibility improvements (ARIA labels, keyboard nav)
7. Error handling and user feedback
8. Loading states and skeletons
9. Documentation:
    - User guide
    - Admin guide
    - Developer docs
10. Deployment preparation

**Deliverables**:
- [ ] All features tested and working
- [ ] Mobile responsive
- [ ] Performance optimized
- [ ] Security validated
- [ ] Accessible
- [ ] Documented
- [ ] Ready for deployment

---

## Deployment Checklist

### Environment Setup
- [ ] Production database provisioned on own server
- [ ] Environment variables configured
- [ ] File storage directory configured on own server
- [ ] Email service configured (Nodemailer with SMTP)
- [ ] Server requirements met (Node.js, PostgreSQL, storage)

### Database
- [ ] Run migrations on production database
- [ ] Seed initial data (user groups, permissions)
- [ ] Set up automated backups
- [ ] Configure connection pooling

### Application
- [ ] Build production bundle (`npm run build`)
- [ ] Deploy to own server
- [ ] Configure custom domain and DNS
- [ ] Set up SSL certificate (Let's Encrypt)
- [ ] Configure reverse proxy (Nginx/Apache)
- [ ] Set up process manager (PM2 or systemd)

### GitHub Integration
- [ ] Set up GitHub repository
- [ ] Configure GitHub Actions for CI/CD (optional)
- [ ] Set up automated deployment pipeline
- [ ] Configure webhook for auto-deployment on push

### File Storage
- [ ] Create storage directories on server
- [ ] Configure file upload limits
- [ ] Set proper permissions for upload directories
- [ ] Configure file serving (static files or API endpoint)

### Monitoring
- [ ] Set up error tracking (Sentry or own solution)
- [ ] Set up analytics (optional)
- [ ] Configure server logging
- [ ] Set up uptime monitoring

### Security
- [ ] Review security headers
- [ ] Enable rate limiting
- [ ] Configure CSP (Content Security Policy)
- [ ] Review authentication configuration
- [ ] Set up firewall rules
- [ ] Configure HTTPS properly

---

## Best Practices & Guidelines

### Code Style

**TypeScript**:
- Use strict mode
- Define interfaces for all data structures
- Use proper type annotations (avoid `any`)
- Leverage union types and type guards

**Svelte**:
- Use `<script lang="ts">` for TypeScript
- Keep components focused and single-purpose
- Use stores for shared state
- Prefer reactive statements (`$:`) for derived values

**Naming Conventions**:
- Components: PascalCase (`ClientForm.svelte`)
- Files: kebab-case (`access-control.ts`)
- Variables/functions: camelCase (`checkPermission`)
- Constants: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)
- Database tables: PascalCase (`UserGroup`)
- Database fields: camelCase (`createdAt`)

### Component Organization

**Component Structure**:
```svelte
<script lang="ts">
  // 1. Imports
  import { Button } from '$lib/components/ui/button';
  
  // 2. Props
  export let title: string;
  export let onSave: () => void;
  
  // 3. State
  let isLoading = false;
  
  // 4. Reactive statements
  $: isValid = title.length > 0;
  
  // 5. Functions
  function handleSubmit() {
    // ...
  }
  
  // 6. Lifecycle (onMount, etc.)
</script>

<!-- 7. Template -->
<div>
  <!-- content -->
</div>

<!-- 8. Styles (if needed, prefer Tailwind) -->
<style>
  /* component-specific styles */
</style>
```

### Database Best Practices

**Migrations**:
- Always review generated migrations before applying
- Never edit applied migrations
- Use descriptive migration names
- Test migrations on development data

**Queries**:
- Use Prisma's type-safe queries
- Add indexes for frequently queried fields
- Use `select` to limit returned fields
- Use `include` sparingly (avoid n+1 queries)
- Implement pagination for large datasets

**Transactions**:
- Use transactions for multi-step operations
- Keep transactions short
- Handle rollback scenarios

### Security Best Practices

**Authentication**:
- Always hash passwords (bcrypt)
- Use secure session configuration
- Implement CSRF protection
- Set secure cookie flags

**Authorization**:
- Check permissions on every server action
- Never trust client-side permission checks
- Validate user input on server
- Use parameterized queries (Prisma handles this)

**Data Validation**:
- Use Zod or similar for schema validation
- Validate on both client and server
- Sanitize user input
- Implement rate limiting

### Performance Optimization

**Frontend**:
- Lazy load routes
- Use virtual scrolling for large lists
- Optimize images (use WebP)
- Implement skeleton loaders
- Minimize bundle size

**Backend**:
- Use database indexes
- Implement caching where appropriate
- Optimize database queries
- Use connection pooling
- Monitor query performance

### Error Handling

**Client-side**:
- Use try-catch blocks
- Display user-friendly error messages
- Log errors for debugging
- Provide recovery options

**Server-side**:
- Return appropriate HTTP status codes
- Log errors with context
- Don't expose sensitive info in errors
- Implement global error handler

### File Upload & Storage

**Server-side File Handling**:
- Store files in organized directory structure (e.g., `/uploads/receipts/YYYY/MM/`)
- Generate unique filenames (UUID + original extension)
- Validate file types and sizes
- Set proper file permissions
- Implement virus scanning if needed

**File Upload Pattern**:
```typescript
// src/lib/server/file-upload.ts
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/uploads';

export async function saveFile(
  file: File,
  category: 'receipts' | 'documents' | 'offers'
): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  // Create directory structure
  const dir = join(UPLOAD_DIR, category, String(year), month);
  await mkdir(dir, { recursive: true });
  
  // Generate unique filename
  const ext = file.name.split('.').pop();
  const filename = `${randomUUID()}.${ext}`;
  const filepath = join(dir, filename);
  
  // Save file
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);
  
  // Return relative path for database
  return `${category}/${year}/${month}/${filename}`;
}
```

**File Serving**:
- Create API endpoint to serve files with authentication
- Check user permissions before serving
- Set appropriate Content-Type headers
- Implement download vs inline display

### Testing Strategy

**Unit Tests**:
- Test utility functions
- Test form validation
- Test calculations (money, dates)

**Integration Tests**:
- Test API routes
- Test database operations
- Test authentication flow

**E2E Tests** (optional):
- Test critical user flows
- Test across browsers

---

## Common Patterns & Code Examples

### Permission Check Pattern

```typescript
// src/routes/(app)/clients/+page.server.ts
import { requirePermission } from '$lib/server/access-control';
import { logAction } from '$lib/server/audit';

export const load = async ({ locals }) => {
  await requirePermission(locals, 'clients', 'read');
  
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    include: { createdBy: { select: { name: true } } }
  });
  
  return { clients };
};

export const actions = {
  create: async ({ locals, request }) => {
    await requirePermission(locals, 'clients', 'create');
    
    const formData = await request.formData();
    const data = Object.fromEntries(formData);
    
    const client = await prisma.client.create({
      data: {
        ...data,
        companyId: locals.user.companyId,
        createdById: locals.user.id
      }
    });
    
    await logAction(
      locals.user.id,
      'created',
      'clients',
      client.id,
      'Client',
      null,
      client,
      request
    );
    
    return { success: true };
  }
};
```

### Form Handling Pattern

```svelte
<!-- src/routes/(app)/clients/new/+page.svelte -->
<script lang="ts">
  import { superForm } from 'sveltekit-superforms/client';
  import { Button } from '$lib/components/ui/button';
  import FormField from '$lib/components/shared/FormField.svelte';
  
  export let data;
  
  const { form, errors, enhance, delayed } = superForm(data.form, {
    onResult: ({ result }) => {
      if (result.type === 'success') {
        goto('/clients');
      }
    }
  });
</script>

<form method="POST" use:enhance class="space-y-4">
  <FormField
    label="Client Name"
    name="name"
    bind:value={$form.name}
    error={$errors.name}
    required
  />
  
  <FormField
    label="Email"
    name="email"
    type="email"
    bind:value={$form.email}
    error={$errors.email}
    required
  />
  
  <Button type="submit" disabled={$delayed}>
    {$delayed ? 'Creating...' : 'Create Client'}
  </Button>
</form>
```

### DataTable Pattern

```svelte
<!-- src/lib/components/shared/DataTable.svelte -->
<script lang="ts" generics="T">
  import { createTable } from '@tanstack/svelte-table';
  import type { ColumnDef } from '@tanstack/svelte-table';
  
  export let data: T[];
  export let columns: ColumnDef<T>[];
  
  const table = createTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  });
</script>

<div class="rounded-md border">
  <table class="w-full">
    <thead>
      {#each table.getHeaderGroups() as headerGroup}
        <tr>
          {#each headerGroup.headers as header}
            <th class="px-4 py-2 text-left">
              {header.column.columnDef.header}
            </th>
          {/each}
        </tr>
      {/each}
    </thead>
    <tbody>
      {#each table.getRowModel().rows as row}
        <tr class="border-t hover:bg-muted/50">
          {#each row.getVisibleCells() as cell}
            <td class="px-4 py-2">
              <svelte:component 
                this={cell.column.columnDef.cell} 
                {...cell.getContext()} 
              />
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
```

### Money Calculation Pattern

```typescript
// src/lib/utils/currency.ts
// Using native JavaScript for money calculations with proper rounding

/**
 * Round a number to specified decimal places (default 2 for money)
 */
export function roundMoney(amount: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor) / factor;
}

/**
 * Calculate total from an array of items with quantity and price
 */
export function calculateTotal(items: Array<{ quantity: number; price: number }>): number {
  let total = 0;
  for (const item of items) {
    total += roundMoney(item.quantity * item.price);
  }
  return roundMoney(total);
}

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number, currencyCode = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}
```

### Email Sending Pattern

```typescript
// src/lib/server/email.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

export async function sendEmail({
  to,
  subject,
  html,
  attachments = []
}: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; path: string }>;
}) {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@yourcompany.com',
      to,
      subject,
      html,
      attachments
    });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

// Example: Send offer email
export async function sendOfferEmail(
  clientEmail: string,
  offerNumber: string,
  pdfPath: string
) {
  const html = `
    <h1>New Offer: ${offerNumber}</h1>
    <p>Please find attached your offer.</p>
    <p>Thank you for your business!</p>
  `;
  
  await sendEmail({
    to: clientEmail,
    subject: `Offer ${offerNumber}`,
    html,
    attachments: [{
      filename: `offer-${offerNumber}.pdf`,
      path: pdfPath
    }]
  });
}
```

### File Upload Pattern

```typescript
// src/lib/server/file-upload.ts
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function saveUploadedFile(
  file: File,
  category: 'receipts' | 'documents' | 'offers'
): Promise<string> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }
  
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  // Create directory structure: /uploads/receipts/2024/01/
  const dir = join(UPLOAD_DIR, category, String(year), month);
  await mkdir(dir, { recursive: true });
  
  // Generate unique filename
  const ext = file.name.split('.').pop() || 'bin';
  const filename = `${randomUUID()}.${ext}`;
  const filepath = join(dir, filename);
  
  // Save file
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);
  
  // Return relative path for database
  return `${category}/${year}/${month}/${filename}`;
}

// API endpoint to serve files
// src/routes/api/files/[...path]/+server.ts
export async function GET({ params, locals }) {
  await requirePermission(locals, 'files', 'read');
  
  const filepath = join(UPLOAD_DIR, params.path);
  const file = await readFile(filepath);
  
  return new Response(file, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${params.path}"`
    }
  });
}
```

---

## Troubleshooting Guide

### Common Issues

**Prisma Connection Errors**:
- Check `DATABASE_URL` in `.env`
- Verify Docker container is running
- Check PostgreSQL logs

**Auth.js Session Issues**:
- Clear browser cookies
- Verify `NEXTAUTH_SECRET` is set
- Check database session table

**Permission Denied Errors**:
- Verify user has correct user groups
- Check permission seeding
- Review `checkPermission()` logic

**Soft Delete Not Working**:
- Verify Prisma middleware is registered
- Check model has `deletedAt` field
- Review middleware logic

**UI Component Issues**:
- Verify shadcn-svelte installation
- Check Tailwind configuration
- Review component imports

**File Upload Issues**:
- Check `UPLOAD_DIR` exists and has write permissions
- Verify file size limits
- Check MIME type validation
- Review file path construction

**Email Sending Issues**:
- Verify SMTP credentials in `.env`
- Test SMTP connection separately
- Check firewall/port access
- Review email logs

**Server Deployment Issues**:
- Verify Node.js version (20.x LTS)
- Check all environment variables are set
- Verify database connection from server
- Check file permissions on upload directory
- Review reverse proxy configuration (Nginx/Apache)
- Check PM2 or systemd service status

---

## Server Deployment Configuration

### Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # File upload size limit
    client_max_body_size 10M;
    
    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Serve static files directly (optional optimization)
    location /_app/ {
        alias /var/www/company-management/build/_app/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'company-management',
    script: 'build/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/company-management-error.log',
    out_file: '/var/log/pm2/company-management-out.log',
    time: true
  }]
};
```

**PM2 Commands**:
```bash
# Start application
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs company-management

# Restart
pm2 restart company-management

# Start on system boot
pm2 startup
pm2 save
```

### Systemd Service Configuration

```ini
# /etc/systemd/system/company-management.service
[Unit]
Description=Company Management System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/company-management
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/node build/index.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=company-management

[Install]
WantedBy=multi-user.target
```

**Systemd Commands**:
```bash
# Enable and start service
sudo systemctl enable company-management
sudo systemctl start company-management

# Check status
sudo systemctl status company-management

# View logs
sudo journalctl -u company-management -f

# Restart service
sudo systemctl restart company-management
```

### GitHub Actions CI/CD Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build
      run: npm run build
      
    - name: Deploy to server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          cd /var/www/company-management
          git pull origin main
          npm ci --production
          npm run build
          npx prisma migrate deploy
          pm2 restart company-management
```

### Database Backup Script

```bash
#!/bin/bash
# /usr/local/bin/backup-db.sh

BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="company_management"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create backup
pg_dump -U postgres $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Delete backups older than 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

**Crontab for daily backups**:
```bash
# Run daily at 2 AM
0 2 * * * /usr/local/bin/backup-db.sh >> /var/log/db-backup.log 2>&1
```

---

## Resources & Links

### Documentation
- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Auth.js Docs](https://authjs.dev)
- [shadcn-svelte](https://www.shadcn-svelte.com)
- [TailwindCSS Docs](https://tailwindcss.com/docs)

### Libraries
- [Superforms](https://superforms.rocks)
- [TanStack Table](https://tanstack.com/table)
- [date-fns](https://date-fns.org)
- [Nodemailer](https://nodemailer.com)
- [svelte-dnd-action](https://github.com/isaacHagoel/svelte-dnd-action)

### Tools
- [Prisma Studio](https://www.prisma.io/studio)
- [TablePlus](https://tableplus.com) (Database GUI)
- [Hoppscotch](https://hoppscotch.io) (API testing)

---

## Notes for Claude Code

### Context Priorities
1. **Security first**: Always enforce permissions and audit logging
2. **Consistency**: Follow established patterns from existing modules
3. **Type safety**: Use TypeScript strictly
4. **User experience**: Clear error messages, loading states, confirmations
5. **Performance**: Optimize queries, lazy load when possible

### When Creating New Features
1. Check if similar feature exists (reuse patterns)
2. Add appropriate permissions
3. Implement audit logging
4. Add soft delete support
5. Create tests (if applicable)
6. Update this documentation

### File Organization
- Keep modules self-contained
- Extract reusable logic to `/lib`
- Don't duplicate code - create shared components
- Use consistent naming conventions

### Database Changes
- Always create migrations (`npx prisma migrate dev`)
- Test migrations on sample data
- Update this schema documentation
- Verify soft-delete middleware still works

---

**Last Updated**: [Date to be filled by developer]  
**Version**: 1.0  
**Project Start Date**: [To be filled]  
**Expected Completion**: [To be filled based on phase timeline]