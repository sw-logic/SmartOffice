-- Step 1: Add the new 'minutes' column with a default so existing rows are fine
ALTER TABLE "TimeRecord" ADD COLUMN "minutes" INTEGER NOT NULL DEFAULT 0;

-- Step 2: Convert existing hours (Decimal) to minutes (Integer)
UPDATE "TimeRecord" SET "minutes" = ROUND("hours" * 60);

-- Step 3: Drop the old 'hours' column
ALTER TABLE "TimeRecord" DROP COLUMN "hours";

-- Step 4: Remove the default on minutes (was only needed for migration)
ALTER TABLE "TimeRecord" ALTER COLUMN "minutes" DROP DEFAULT;

-- Step 5: Add spentTime column to Task (materialized aggregate of TimeRecord.minutes)
ALTER TABLE "Task" ADD COLUMN "spentTime" INTEGER NOT NULL DEFAULT 0;

-- Step 6: Populate spentTime from existing time records
UPDATE "Task" t
SET "spentTime" = COALESCE(
    (SELECT SUM(tr."minutes")
     FROM "TimeRecord" tr
     WHERE tr."taskId" = t."id" AND tr."deletedAt" IS NULL),
    0
);
