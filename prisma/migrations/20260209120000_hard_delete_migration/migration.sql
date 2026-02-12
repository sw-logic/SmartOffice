-- Hard Delete Migration
-- 1. Populate denormalized name fields from relations
-- 2. Hard-delete all soft-deleted records
-- 3. Drop deletedAt columns and update FK constraints

-- ============================================================================
-- Step 1: Populate denormalized names
-- ============================================================================

-- Add new columns first
ALTER TABLE "Income" ADD COLUMN "clientName" TEXT;
ALTER TABLE "Expense" ADD COLUMN "vendorName" TEXT;

-- Populate clientName from Client relation
UPDATE "Income" SET "clientName" = c."name"
FROM "Client" c WHERE "Income"."clientId" = c."id";

-- Populate vendorName from Vendor relation
UPDATE "Expense" SET "vendorName" = v."name"
FROM "Vendor" v WHERE "Expense"."vendorId" = v."id";

-- ============================================================================
-- Step 2: Hard-delete all soft-deleted records (order matters for FK constraints)
-- ============================================================================

-- Delete child records first (to avoid FK violations)
DELETE FROM "TimeRecord" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "Task" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "Milestone" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "KanbanColumn" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "KanbanSwimlane" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "KanbanBoard" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "Note" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "Income" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "Expense" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "Payment" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "PriceListItem" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "Offer" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "Project" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "Client" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "Vendor" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "Company" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "EnumValue" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "EnumType" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "Permission" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "UserGroup" WHERE "deletedAt" IS NOT NULL;
DELETE FROM "User" WHERE "deletedAt" IS NOT NULL;

-- ============================================================================
-- Step 3: Drop deletedAt columns
-- ============================================================================

ALTER TABLE "Client" DROP COLUMN "deletedAt";
ALTER TABLE "Company" DROP COLUMN "deletedAt";
ALTER TABLE "EnumType" DROP COLUMN "deletedAt";
ALTER TABLE "EnumValue" DROP COLUMN "deletedAt";
ALTER TABLE "Expense" DROP COLUMN "deletedAt";
ALTER TABLE "Income" DROP COLUMN "deletedAt";
ALTER TABLE "KanbanBoard" DROP COLUMN "deletedAt";
ALTER TABLE "KanbanColumn" DROP COLUMN "deletedAt";
ALTER TABLE "KanbanSwimlane" DROP COLUMN "deletedAt";
ALTER TABLE "Milestone" DROP COLUMN "deletedAt";
ALTER TABLE "Note" DROP COLUMN "deletedAt";
ALTER TABLE "Offer" DROP COLUMN "deletedAt";
ALTER TABLE "Payment" DROP COLUMN "deletedAt";
ALTER TABLE "Permission" DROP COLUMN "deletedAt";
ALTER TABLE "PriceListItem" DROP COLUMN "deletedAt";
ALTER TABLE "Project" DROP COLUMN "deletedAt";
ALTER TABLE "Task" DROP COLUMN "deletedAt";
ALTER TABLE "TimeRecord" DROP COLUMN "deletedAt";
ALTER TABLE "User" DROP COLUMN "deletedAt";
ALTER TABLE "UserGroup" DROP COLUMN "deletedAt";
ALTER TABLE "Vendor" DROP COLUMN "deletedAt";

-- ============================================================================
-- Step 4: Update FK constraints
-- ============================================================================

-- Note: authorId becomes nullable
ALTER TABLE "Note" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "Note" DROP CONSTRAINT "Note_authorId_fkey";
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Income: parent → Cascade, client → SetNull, project → SetNull, payment → SetNull
ALTER TABLE "Income" DROP CONSTRAINT "Income_parentId_fkey";
ALTER TABLE "Income" ADD CONSTRAINT "Income_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Income"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Income" DROP CONSTRAINT "Income_clientId_fkey";
ALTER TABLE "Income" ADD CONSTRAINT "Income_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Income" DROP CONSTRAINT "Income_projectId_fkey";
ALTER TABLE "Income" ADD CONSTRAINT "Income_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Income" DROP CONSTRAINT "Income_paymentId_fkey";
ALTER TABLE "Income" ADD CONSTRAINT "Income_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Expense: parent → Cascade, project → SetNull, vendor → SetNull, payment → SetNull
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_parentId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expense" DROP CONSTRAINT "Expense_projectId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense" DROP CONSTRAINT "Expense_vendorId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense" DROP CONSTRAINT "Expense_paymentId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Task: kanbanBoard → SetNull, column → SetNull, swimlane → SetNull
ALTER TABLE "Task" DROP CONSTRAINT "Task_kanbanBoardId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_kanbanBoardId_fkey" FOREIGN KEY ("kanbanBoardId") REFERENCES "KanbanBoard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" DROP CONSTRAINT "Task_columnId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "KanbanColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" DROP CONSTRAINT "Task_swimlaneId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_swimlaneId_fkey" FOREIGN KEY ("swimlaneId") REFERENCES "KanbanSwimlane"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Note: Task.assignedToId, Project.projectManagerId, TimeRecord.userId FKs
-- already updated to reference User with ON DELETE SET NULL
-- by the person_to_contact_user migration

-- Payment: client → SetNull
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_clientId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
