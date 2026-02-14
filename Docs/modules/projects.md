# Projects Module

Project management with Kanban boards, tasks, time tracking, milestones, and team management.

## Routes

| Route | Pattern | Purpose |
|-------|---------|---------|
| `/projects` | List page | Projects list with search, sort, pagination, status filter |
| `/projects/new` | Full-page form | Create project |
| `/projects/[id]` | Detail page | Project details: Overview, Team, Milestones, Boards, Tasks |
| `/projects/[id]/edit` | Full-page form | Edit project |
| `/projects/boards/[id]` | Board view | Kanban board with drag-and-drop task management |
| `/projects/boards/[id]/settings` | Board settings | Columns, swimlanes, members management |
| `/projects/tasks` | Task list | All tasks with advanced filtering and bulk operations |

## Architecture

```
Project (linked to Client)
  ├── Team Members (ProjectEmployee many-to-many)
  ├── Project Manager (User)
  ├── Milestones (ordered, with completion tracking)
  ├── KanbanBoard(s)
  │   ├── Members (KanbanBoardMember — subset of project team)
  │   ├── Columns (ordered, one can be "complete column")
  │   ├── Swimlanes (ordered, for categorization)
  │   └── Tasks (placed in column × swimlane grid cells)
  └── Tasks (all tasks, whether on a board or not)
      ├── TimeRecords (minutes-based → materialized spentTime)
      ├── Notes (polymorphic)
      └── Tags (polymorphic via EntityTag → EnumValue)
```

## API Endpoints

### Tasks

| Method | Route | Permission | Purpose |
|--------|-------|------------|---------|
| POST | `/api/tasks` | `projects.update` | Create task |
| GET | `/api/tasks/[id]` | `projects.read` | Get task with notes, tags, time records |
| PATCH | `/api/tasks/[id]` | `projects.update` | Update task |
| DELETE | `/api/tasks/[id]` | `projects.delete` | Delete task (cascade: time records, notes, tags) |
| GET | `/api/tasks/modal-data` | `projects.read` | Lazy-load reference data for TaskDetailModal |

### Time Records

| Method | Route | Permission | Purpose |
|--------|-------|------------|---------|
| POST | `/api/tasks/[id]/time-records` | `projects.update` | Create time record |
| PATCH | `/api/tasks/[id]/time-records/[recordId]` | `projects.update` | Update time record |
| DELETE | `/api/tasks/[id]/time-records/[recordId]` | `projects.update` | Delete time record |

## Project Model

Key fields:
- `name` (String), `description` (String?, markdown)
- `companyId` (Int), `clientId` (Int) — both required
- `status` (String) — planning, active, on_hold, completed, cancelled, archived
- `priority` (String) — low, medium, high (enum-based)
- `startDate`, `endDate` (DateTime?)
- `budgetEstimate`, `estimatedHours` (Decimal?) — visible only to admin/accountant
- `projectManagerId` (Int?) — User reference

Relations:
- `assignedEmployees` (ProjectEmployee[]), `kanbanBoards` (KanbanBoard[])
- `tasks` (Task[]), `milestones` (Milestone[])
- `income` (Income[]), `expenses` (Expense[])

Indexes: `companyId`, `clientId`, `status`

## Task Model

Key fields:
- `name` (String), `description` (String?, markdown)
- `projectId` (Int, required) — every task belongs to a project
- `kanbanBoardId`, `columnId`, `swimlaneId` (Int?) — optional board placement
- `order` (Int) — position within column/swimlane cell
- `type` (String?) — Enum `task_type`
- `category` (String?) — Enum `task_category`
- `status` (String) — backlog, todo, in_progress, review, done
- `priority` (String) — low, medium, high, urgent
- `isComplete` (Boolean) — auto-synced with column's `isCompleteColumn`
- `assignedToId` (Int?) — single assignee
- `reviewerIds`, `followerIds` (Int[]) — arrays of user IDs
- `startDate`, `dueDate` (DateTime?)
- `estimatedTime` (Int?) — minutes
- `spentTime` (Int, default 0) — materialized aggregate from TimeRecords

Relations:
- `timeRecords` (TimeRecord[])
- Notes and Tags via polymorphic `entityType: 'Task'`

## TimeRecord Model

Key fields:
- `taskId` (Int?), `date` (DateTime), `minutes` (Int)
- `description` (String?), `billable` (Boolean, default true)
- `type` (String?) — Enum `time_record_type`
- `category` (String?) — Enum `time_record_category`
- `userId` (Int?) — who did the work
- `createdById` (Int) — who logged the record

Materialized aggregate: After every create/update/delete, `recalcTaskSpentTime(taskId)` recalculates `task.spentTime`.

## KanbanBoard Model

Key fields:
- `projectId` (Int), `name` (String), `description` (String?)

Relations:
- `members` (KanbanBoardMember[]) — access control
- `columns` (KanbanColumn[]) — ordered, with `isCompleteColumn` flag
- `swimlanes` (KanbanSwimlane[]) — ordered
- `preferences` (UserBoardPreference[]) — collapsed state per user

Default columns: Backlog, To Do, In Progress, Review, Done
Default swimlanes: Bugs, New Requests, Tasks, Ideas

## Kanban Board View

- **Full-width grid**: columns split width equally (`1fr`), min 200px each
- **Column × Swimlane grid cells**: tasks placed at intersection
- **Drag-and-drop**: `svelte-dnd-action` with 200ms flip animation
- **Collapsible**: columns (36px vertical bar) and swimlanes (horizontal bar)
- **Sticky column headers**
- **Complete column auto-sync**: tasks moved to "Done" column → `isComplete = true`
- **Navigation bar**: Back button, client filter, board dropdown, search popover, settings

## Board Settings

**18 server actions** for managing:
1. **Columns**: add, update, delete (prevented if tasks exist), reorder, toggle complete column
2. **Swimlanes**: add, update, delete (prevented if tasks exist), reorder
3. **Members**: assign from project team, change role (member/viewer)

## Task Management

### TaskDetailModal
- **Create mode**: single-step form with all fields, optional board/column/swimlane defaults
- **View mode**: tabbed interface (Details, Time, Notes) with inline editing
- **Edit mode**: toggled with Edit button, shows all dropdowns
- **Lazy modal data**: reference data fetched once per session via `/api/tasks/modal-data`

### TaskCard
- Priority color bar (left border, 3px), name, tags (colored badges)
- Due date badge, time badge (spent/estimated), assignee avatar
- Timer icon (global timer integration)

### Task List Page
- Advanced filtering: project, client, board, assignee, status, type, category, priority
- Grouping support, checkbox selection for bulk delete
- Clickable rows → TaskDetailModal

## Key Patterns

### Materialized Aggregates
`task.spentTime` updated incrementally via `recalcTaskSpentTime()` after every time record change — avoids expensive SUM queries on reads.

### Lazy Modal Data Loading
`GET /api/tasks/modal-data` fetches projects, employees, and available tags once per session, cached in component state.

### Complete Column Auto-Sync
When a task moves to the column marked `isCompleteColumn`, `task.isComplete` is set to `true` automatically. Bulk-synced when the complete column designation changes.

### Row-Level Access
- `canAccessProject(locals, projectId)` — admin OR project manager OR team member
- `isProjectManager(locals, projectId)` — project manager check
- Time record edit/delete: creator, admin, or project manager only

## Components

| Component | Purpose |
|-----------|---------|
| `TaskDetailModal` | Full task CRUD modal with tabs |
| `TaskCard` | Compact task card for Kanban board |
| `TaskTimeRecordsList` | Time records table with CRUD |
| `TimeRecordFormModal` | Time record create/edit modal |
| `DurationInput` | "1w 2d 3h 30m" → minutes input |
| `MilestoneFormModal` | Milestone create/edit modal |
| `NotesList` | Polymorphic notes with markdown |

## Enums

| Code | Module | Purpose |
|------|--------|---------|
| `project_status` | Projects | Project status |
| `priority` | Generic | Priority levels with colors |
| `task_status` | Projects | Task status |
| `task_type` | Projects | Task type classification |
| `task_category` | Projects | Task category |
| `time_record_type` | Time | Time record type |
| `time_record_category` | Time | Time record category |
| `task_tags` | Projects | Freeform tags with colors |

## Permissions

Module: `projects` — Actions: `read`, `create`, `update`, `delete`

Board-specific: `projects.kanban` — board settings (columns, swimlanes, members)

Budget visibility: admin or `finances.income.*` permission
