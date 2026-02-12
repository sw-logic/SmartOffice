-- Step 1: Add a temporary integer column
ALTER TABLE "Task" ADD COLUMN "estimatedTime_new" INTEGER;

-- Step 2: Convert existing hours (Decimal) to minutes (Integer)
UPDATE "Task" SET "estimatedTime_new" = ROUND("estimatedTime" * 60)
WHERE "estimatedTime" IS NOT NULL;

-- Step 3: Drop the old Decimal column
ALTER TABLE "Task" DROP COLUMN "estimatedTime";

-- Step 4: Rename the new column
ALTER TABLE "Task" RENAME COLUMN "estimatedTime_new" TO "estimatedTime";
