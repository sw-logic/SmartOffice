# SmartOffice - Permissions Reference

## Overview

Permissions follow the pattern `module.action` (e.g., `clients.read`). They are assigned to **UserGroups**, not directly to users. Users inherit permissions through group membership.

Permissions are loaded once per request in `hooks.server.ts` and cached in `event.locals.permissions`.

### Wildcard Matching

| Pattern | Scope |
|---------|-------|
| `*.*` | Global admin — matches all modules and actions |
| `module.*` | Module wildcard — matches all actions in a module |

### Enforcement Functions

| Function | Purpose |
|----------|---------|
| `requirePermission(locals, module, action)` | Throws 303 redirect if user lacks permission |
| `checkPermission(locals, module, action)` | Returns boolean, used for conditional UI |
| `isAdmin(locals)` | Shorthand for `checkPermission(locals, '*', '*')` |
| `hasAnyPermission(locals, [...])` | Returns true if user has any of the listed permissions |
| `hasAllPermissions(locals, [...])` | Returns true if user has all of the listed permissions |

---

## Permissions by Module

### Admin

| Permission | Description |
|------------|-------------|
| `*.*` | Full access to all modules and actions |

### Dashboard

| Permission | Description |
|------------|-------------|
| `dashboard.read` | View dashboard |
| `dashboard.finances` | View financial widgets on dashboard |

### Clients

| Permission | Description | Enforced In |
|------------|-------------|-------------|
| `clients.read` | View clients list and details | `clients/+page.server.ts`, `clients/[id]/+page.server.ts` |
| `clients.create` | Create new clients | `clients/new/+page.server.ts` |
| `clients.update` | Edit client records | `clients/[id]/edit/+page.server.ts`, soft-delete/restore actions |
| `clients.delete` | Delete clients (soft delete) | `clients/+page.server.ts` delete action |
| `clients.export` | Export client data | — |
| `clients.contacts` | Manage client contact persons | `clients/[id]/+page.server.ts` contact actions |

### Vendors

| Permission | Description | Enforced In |
|------------|-------------|-------------|
| `vendors.read` | View vendors list and details | `vendors/+page.server.ts`, `vendors/[id]/+page.server.ts` |
| `vendors.create` | Create new vendors | `vendors/new/+page.server.ts` |
| `vendors.update` | Edit vendor records | `vendors/[id]/edit/+page.server.ts`, soft-delete/restore actions |
| `vendors.delete` | Delete vendors (soft delete) | `vendors/+page.server.ts` delete action |
| `vendors.export` | Export vendor data | — |
| `vendors.contacts` | Manage vendor contact persons | `vendors/[id]/+page.server.ts` contact actions |

### Employees

| Permission | Description | Enforced In |
|------------|-------------|-------------|
| `employees.read` | View employees list and details | `employees/+page.server.ts`, `employees/[id]/+page.server.ts` |
| `employees.create` | Create new employees | `employees/new/+page.server.ts` |
| `employees.update` | Edit employee records | `employees/[id]/edit/+page.server.ts`, soft-delete/restore actions |
| `employees.delete` | Delete employees (soft delete) | `employees/+page.server.ts` delete action |
| `employees.permissions` | Manage employee user account and group assignments | `employees/[id]/+page.server.ts` permission actions |
| `employees.salary` | View and edit salary information | Checked conditionally in employee pages and finance dashboard |

### Projects

| Permission | Description | Enforced In |
|------------|-------------|-------------|
| `projects.read` | View projects, boards, and tasks | `projects/+page.server.ts`, `projects/[id]/+page.server.ts`, `boards/`, `tasks/` |
| `projects.create` | Create new projects | `projects/new/+page.server.ts` |
| `projects.update` | Edit projects, move/reorder tasks, manage task notes/tags/time-records | `projects/[id]/edit/`, task API endpoints |
| `projects.delete` | Delete projects (soft delete) | `projects/+page.server.ts` delete action |
| `projects.tasks` | Manage project tasks | — |
| `projects.kanban` | Manage kanban board settings (columns, swimlanes, members) | `boards/[id]/settings/+page.server.ts` (all actions) |
| `projects.milestones` | Manage project milestones | — |
| `projects.budget` | View project budget and estimates | Checked conditionally on project detail/edit pages |

### Tasks (via API)

| Permission | Description | Enforced In |
|------------|-------------|-------------|
| `tasks.read` | View tasks | — |
| `tasks.create` | Create tasks | — |
| `tasks.update` | Update tasks | — |
| `tasks.delete` | Delete tasks | — |

> Note: Task API endpoints currently enforce `projects.read` / `projects.update` / `projects.delete` rather than the `tasks.*` permissions.

### Time Records

| Permission | Description |
|------------|-------------|
| `time_records.read` | View time records |
| `time_records.create` | Create time records |
| `time_records.update` | Update time records |
| `time_records.delete` | Delete time records |

> Note: Time record API endpoints currently enforce `projects.update` rather than `time_records.*` permissions.

### Notes

| Permission | Description |
|------------|-------------|
| `notes.read` | View notes |
| `notes.create` | Create notes |
| `notes.update` | Update notes |
| `notes.delete` | Delete notes |

> Note: The notes API uses a dynamic entity-type-to-module mapping to determine which module permission to check.

### Finances - Income

| Permission | Description | Enforced In |
|------------|-------------|-------------|
| `finances.income.read` | View income records | `finances/income/+page.server.ts`, `api/income/[id]/+server.ts` |
| `finances.income.create` | Create income records | `finances/income/new/+page.server.ts`, `api/income/+server.ts` |
| `finances.income.update` | Edit income records | `finances/income/[id]/edit/+page.server.ts`, `api/income/[id]/+server.ts` |
| `finances.income.delete` | Delete income records (soft delete) | `finances/income/+page.server.ts` delete action |
| `finances.income.export` | Export income reports | — |

### Finances - Expenses

| Permission | Description | Enforced In |
|------------|-------------|-------------|
| `finances.expenses.read` | View expense records | `finances/expenses/+page.server.ts`, `api/expenses/[id]/+server.ts` |
| `finances.expenses.create` | Create expense records | `finances/expenses/new/+page.server.ts`, `api/expenses/+server.ts` |
| `finances.expenses.update` | Edit expense records | `finances/expenses/[id]/edit/+page.server.ts`, `api/expenses/[id]/+server.ts` |
| `finances.expenses.delete` | Delete expense records (soft delete) | `finances/expenses/+page.server.ts` delete action |
| `finances.expenses.export` | Export expense reports | — |

### Finances - Payments

| Permission | Description |
|------------|-------------|
| `finances.payments.read` | View payments |
| `finances.payments.create` | Create payment records |
| `finances.payments.update` | Update payment records |
| `finances.payments.delete` | Delete payment records |
| `finances.payments.reconcile` | Reconcile payments |

> Note: Payments module is not yet implemented.

### Price Lists

| Permission | Description | Enforced In |
|------------|-------------|-------------|
| `pricelists.read` | View price lists | `pricelists/+page.server.ts` |
| `pricelists.create` | Create price list items | `pricelists/new/+page.server.ts` |
| `pricelists.update` | Edit price list items | `pricelists/[id]/edit/+page.server.ts`, inline edit actions |
| `pricelists.delete` | Delete price list items (soft delete) | `pricelists/+page.server.ts` delete action |
| `pricelists.history` | View price history | — |

### Offers

| Permission | Description |
|------------|-------------|
| `offers.read` | View offers |
| `offers.create` | Create offers |
| `offers.update` | Update offers |
| `offers.delete` | Delete offers |
| `offers.send` | Send offers via email |
| `offers.convert` | Convert offers to projects |

> Note: Offers module is not yet fully implemented.

### Settings

| Permission | Description | Enforced In |
|------------|-------------|-------------|
| `settings.read` | View settings | — |
| `settings.company` | Edit company settings | — |
| `settings.users` | Manage users and user groups | `users/+page.server.ts`, `users/groups/+page.server.ts` and all sub-routes |
| `settings.system` | System settings | — |
| `settings.enums` | Manage enum types and values | `settings/enums/+page.server.ts`, `settings/enums/[code]/+page.server.ts` |

---

## Default User Groups

### Admin

Full access via `*.*` wildcard permission.

### Manager

| Module | Permissions |
|--------|-------------|
| Dashboard | `read` |
| Clients | `read`, `create`, `update`, `contacts` |
| Vendors | `read`, `create`, `update` |
| Employees | `read` |
| Projects | `read`, `create`, `update`, `tasks`, `kanban`, `milestones` |
| Tasks | `read`, `create`, `update`, `delete` |
| Time Records | `read`, `create` |
| Notes | `read`, `create` |
| Finances | `income.read`, `expenses.read`, `payments.read` |
| Offers | `read`, `create`, `update`, `send` |
| Price Lists | `read` |
| Settings | `read` |

### Accountant

| Module | Permissions |
|--------|-------------|
| Dashboard | `read`, `finances` |
| Clients | `read` |
| Vendors | `read` |
| Projects | `read`, `budget` |
| Time Records | `read` |
| Income | `read`, `create`, `update`, `delete`, `export` |
| Expenses | `read`, `create`, `update`, `delete`, `export` |
| Payments | `read`, `create`, `update`, `delete`, `reconcile` |
| Offers | `read` |
| Price Lists | `read` |

### Employee

| Module | Permissions |
|--------|-------------|
| Dashboard | `read` |
| Clients | `read` |
| Projects | `read`, `tasks` |
| Tasks | `read`, `create`, `update` |
| Time Records | `read`, `create`, `update` |
| Notes | `read`, `create` |
| Offers | `read` |

---

## Conditional UI Behavior

| Check | Effect |
|-------|--------|
| `isAdmin` (`*.*`) | Shows soft-deleted records filter, restore buttons, admin-only fields |
| `employees.salary` | Shows/hides salary column and field in employee views and finance dashboard |
| `projects.budget` | Shows/hides budget and estimated hours on project detail/edit pages |
| `finances.income.*` (accountant check) | Shows budget fields on project pages for accountant role |
