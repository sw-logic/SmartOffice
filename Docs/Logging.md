# SmartOffice - Audit Logging Reference

## Overview

All important actions are logged to the `AuditLog` table via helper functions in `src/lib/server/audit.ts`. Each log entry captures who did what, when, and the before/after state.

### AuditLog Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Auto-increment primary key |
| `userId` | String | User who performed the action |
| `action` | String | Action type (see below) |
| `module` | String | Module name (e.g., `clients`, `finances.income`) |
| `entityId` | String? | ID of the affected record |
| `entityType` | String? | Type name (e.g., `Client`, `Task`, `Income`) |
| `oldValues` | Json? | Previous state (for updates/deletes) |
| `newValues` | Json? | New state (for creates/updates) |
| `ipAddress` | String? | Client IP address |
| `userAgent` | String? | Client user agent |
| `createdAt` | DateTime | Timestamp |

### Action Types

| Action | Description |
|--------|-------------|
| `created` | Resource created |
| `updated` | Resource updated |
| `deleted` | Resource soft-deleted |
| `restored` | Resource restored from deletion |
| `exported` | Data exported |
| `login` | Successful login |
| `login_failed` | Failed login attempt |
| `logout` | User logout |
| `password_changed` | Password changed |
| `permission_changed` | Permissions modified |

### Helper Functions

| Function | Action | Logs |
|----------|--------|------|
| `logAction(params)` | Any | Full control over all fields |
| `logCreate(userId, module, entityId, entityType, newValues)` | `created` | `newValues` only |
| `logUpdate(userId, module, entityId, entityType, oldValues, newValues)` | `updated` | Both `oldValues` and `newValues` |
| `logDelete(userId, module, entityId, entityType, oldValues)` | `deleted` | `oldValues` only |
| `logLogin(userId, ...)` | `login` | Login metadata |
| `logLogout(userId)` | `logout` | — |
| `logExport(userId, module, details)` | `exported` | Export details |

---

## Clients Module (`clients`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `Client` | name, companyName, email, status | `clients/new/+page.server.ts` |
| `updated` | `Client` | name, companyName, email, phone, website, street, city, postalCode, country, taxId, vatNumber, industry, status, paymentTerms, currency, notes | `clients/[id]/edit/+page.server.ts` |
| `deleted` | `Client` | name, companyName | `clients/+page.server.ts` |
| `restored` | `Client` | deletedAt (old) → null (new) | `clients/+page.server.ts` |
| `created` | `Person` | firstName, lastName, email | `clients/[id]/+page.server.ts` (add contact) |
| `updated` | `Person` | firstName, lastName, email | `clients/[id]/+page.server.ts` (edit contact) |
| `deleted` | `Person` | firstName, lastName, email | `clients/[id]/+page.server.ts` (remove contact) |

---

## Vendors Module (`vendors`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `Vendor` | name, companyName, email, category | `vendors/new/+page.server.ts` |
| `updated` | `Vendor` | name, companyName, email, phone, website, street, city, postalCode, country, taxId, vatNumber, category, status, paymentTerms, currency, notes | `vendors/[id]/edit/+page.server.ts` |
| `deleted` | `Vendor` | name, companyName | `vendors/+page.server.ts` |
| `restored` | `Vendor` | deletedAt (old) → null (new) | `vendors/+page.server.ts` |
| `created` | `Person` | firstName, lastName, email | `vendors/[id]/+page.server.ts` (add contact) |
| `updated` | `Person` | firstName, lastName, email | `vendors/[id]/+page.server.ts` (edit contact) |
| `deleted` | `Person` | firstName, lastName, email | `vendors/[id]/+page.server.ts` (remove contact) |

---

## Employees Module (`employees`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `Person` | firstName, lastName, email, jobTitle, department | `employees/new/+page.server.ts` |
| `updated` | `Person` | All changed employee fields (dynamic diff) | `employees/[id]/edit/+page.server.ts` |
| `updated` | `Person` | Field-level changes (user account, permissions) | `employees/[id]/+page.server.ts` |
| `deleted` | `Person` | firstName, lastName, email | `employees/+page.server.ts` |
| `updated` | `Person` | employeeStatus and related fields (restore) | `employees/+page.server.ts` |

---

## Projects Module (`projects`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `Project` | name, clientId, status, priority | `projects/new/+page.server.ts` |
| `updated` | `Project` | name, description, clientId, status, priority, startDate, endDate, budgetEstimate, estimatedHours, projectManagerId, notes | `projects/[id]/edit/+page.server.ts` |
| `deleted` | `Project` | name | `projects/+page.server.ts` |
| `restored` | `Project` | deletedAt (old) → null (new) | `projects/+page.server.ts` |
| `updated` | `Project` | teamMemberIds (old) → teamMemberIds (new) | `projects/[id]/+page.server.ts` (team update) |
| `created` | `Milestone` | name, description, date, projectId | `projects/[id]/+page.server.ts` |
| `deleted` | `Milestone` | name, projectId | `projects/[id]/+page.server.ts` |

---

## Tasks Module (`projects`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `Task` | name, projectId | `api/tasks/+server.ts` |
| `updated` | `Task` | All changed fields (dynamic diff) | `api/tasks/[id]/+server.ts` |
| `deleted` | `Task` | name | `api/tasks/[id]/+server.ts`, `projects/tasks/+page.server.ts` |
| `restored` | `Task` | deletedAt (old) → null (new) | `projects/tasks/+page.server.ts` |
| `updated` | `Task` | Reorder: task IDs and count | `projects/boards/[id]/+page.server.ts` |

---

## Time Records Module (`projects`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `TimeRecord` | taskId, date, minutes, personId, billable | `api/tasks/[id]/time-records/+server.ts` |
| `updated` | `TimeRecord` | All changed fields (dynamic diff) | `api/tasks/[id]/time-records/[recordId]/+server.ts` |
| `deleted` | `TimeRecord` | minutes, date | `api/tasks/[id]/time-records/[recordId]/+server.ts` |

---

## Notes Module (`projects`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `Note` | entityType, entityId, content | `api/notes/+server.ts`, `api/tasks/[id]/notes/+server.ts` |
| `updated` | `Note` | All changed fields (dynamic diff) | `api/notes/[id]/+server.ts` |
| `deleted` | `Note` | content | `api/notes/[id]/+server.ts` |

---

## Tags Module (`projects`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `EntityTag` | entityType, entityId, enumValueId | `api/tasks/[id]/tags/+server.ts` |
| `deleted` | `EntityTag` | entityType, entityId, enumValueId | `api/tasks/[id]/tags/+server.ts` |

---

## Kanban Boards Module (`projects`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `deleted` | `KanbanBoard` | name | `projects/boards/+page.server.ts` |
| `restored` | `KanbanBoard` | deletedAt (old) → null (new) | `projects/boards/+page.server.ts` |
| `updated` | `KanbanBoard` | columnOrder | `projects/boards/[id]/+page.server.ts` |
| `updated` | `KanbanBoard` | swimlaneOrder | `projects/boards/[id]/+page.server.ts` |

---

## Kanban Settings Module (`projects.kanban`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `KanbanColumn` | boardId, name, color | `boards/[id]/settings/+page.server.ts` |
| `updated` | `KanbanColumn` | name, color | `boards/[id]/settings/+page.server.ts` |
| `deleted` | `KanbanColumn` | name, boardId | `boards/[id]/settings/+page.server.ts` |
| `updated` | `KanbanBoard` | columnOrder | `boards/[id]/settings/+page.server.ts` |
| `created` | `KanbanSwimlane` | boardId, name, color | `boards/[id]/settings/+page.server.ts` |
| `updated` | `KanbanSwimlane` | name, color | `boards/[id]/settings/+page.server.ts` |
| `deleted` | `KanbanSwimlane` | name, boardId | `boards/[id]/settings/+page.server.ts` |
| `restored` | `KanbanSwimlane` | deletedAt (old) → null (new) | `boards/[id]/settings/+page.server.ts` |
| `updated` | `KanbanBoard` | swimlaneOrder | `boards/[id]/settings/+page.server.ts` |
| `updated` | `KanbanBoard` | memberIds (old) → memberIds (new) | `boards/[id]/settings/+page.server.ts` |

---

## Finances - Income Module (`finances.income`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `Income` | amount, description, category, date, status | `api/income/+server.ts`, `finances/income/new/+page.server.ts` |
| `updated` | `Income` | amount, currency, date, description, category, status, dueDate, tax, taxRate, isRecurring, recurringPeriod, clientId, projectId, invoiceReference, notes | `finances/income/[id]/edit/+page.server.ts` |
| `updated` | `Income` | All changed fields (dynamic diff) | `api/income/[id]/+server.ts` |
| `updated` | `Income` | status (old) → status (new) | `finances/income/+page.server.ts` (status change) |
| `deleted` | `Income` | amount, description, category, date, status | `finances/income/+page.server.ts` |

---

## Finances - Expenses Module (`finances.expenses`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `Expense` | amount, description, category, date, status | `api/expenses/+server.ts`, `finances/expenses/new/+page.server.ts` |
| `updated` | `Expense` | amount, currency, date, description, category, status, dueDate, tax, taxRate, isRecurring, recurringPeriod, vendorId, projectId, notes | `finances/expenses/[id]/edit/+page.server.ts` |
| `updated` | `Expense` | All changed fields (dynamic diff) | `api/expenses/[id]/+server.ts` |
| `updated` | `Expense` | status (old) → status (new) | `finances/expenses/+page.server.ts` (status change) |
| `deleted` | `Expense` | amount, description, category, date, status | `finances/expenses/+page.server.ts` |

---

## Price Lists Module (`pricelists`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `PriceListItem` | name, sku, category, unitPrice | `pricelists/new/+page.server.ts` |
| `updated` | `PriceListItem` | All changed fields (dynamic diff) | `pricelists/[id]/edit/+page.server.ts` |
| `updated` | `PriceListItem` | active (old) → active (new) | `pricelists/+page.server.ts` (status toggle) |
| `deleted` | `PriceListItem` | name, sku, category | `pricelists/+page.server.ts` |

---

## Users Module (`users`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `User` | name, email, role | `users/new/+page.server.ts` |
| `updated` | `User` | name, email | `users/[id]/edit/+page.server.ts` |
| `deleted` | `User` | email, name | `users/+page.server.ts` |
| `restored` | `User` | deletedAt (old) → null (new) | `users/+page.server.ts` |

---

## User Groups Module (`user-groups`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `UserGroup` | name, description, permissions | `users/groups/new/+page.server.ts` |
| `updated` | `UserGroup` | name, description, permissions | `users/groups/[id]/edit/+page.server.ts` |
| `deleted` | `UserGroup` | name | `users/groups/+page.server.ts` |
| `restored` | `UserGroup` | deletedAt (old) → null (new) | `users/groups/+page.server.ts` |

---

## Settings - Enums Module (`settings.enums`)

| Action | Entity Type | Logged Fields | Location |
|--------|-------------|---------------|----------|
| `created` | `EnumValue` | enumType, value, label | `settings/enums/[code]/+page.server.ts` |
| `updated` | `EnumValue` | value, label, isActive | `settings/enums/[code]/+page.server.ts` |
| `updated` | `EnumValue` | isDefault: true (set default) | `settings/enums/[code]/+page.server.ts` |
| `deleted` | `EnumValue` | value, label | `settings/enums/[code]/+page.server.ts` |
| `restored` | `EnumValue` | deletedAt (old) → null (new) | `settings/enums/[code]/+page.server.ts` |

---

## Summary

### Totals by Action

| Action | Count |
|--------|-------|
| `created` | ~20 |
| `updated` | ~30 |
| `deleted` | ~18 |
| `restored` | ~10 |
| **Total** | **~78** |

### Module Names Used in Logs

| Module Name | Entity Types |
|-------------|-------------|
| `clients` | Client, Person |
| `vendors` | Vendor, Person |
| `employees` | Person |
| `projects` | Project, Milestone, Task, TimeRecord, Note, EntityTag, KanbanBoard |
| `projects.kanban` | KanbanColumn, KanbanSwimlane, KanbanBoard |
| `finances.income` | Income |
| `finances.expenses` | Expense |
| `pricelists` | PriceListItem |
| `users` | User |
| `user-groups` | UserGroup |
| `settings.enums` | EnumValue |

### Modules Without Logging

| Module | Status |
|--------|--------|
| Offers | Not yet implemented |
| Payments | Not yet implemented |
| Dashboard | Read-only, no mutations |
| Finance Dashboard | Read-only, no mutations |
