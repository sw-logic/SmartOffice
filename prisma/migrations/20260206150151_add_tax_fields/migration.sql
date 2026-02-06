-- AlterTable: Add tax columns to Expense (nullable first for existing rows)
ALTER TABLE "Expense" ADD COLUMN "tax" DECIMAL(10,2),
ADD COLUMN "tax_value" DECIMAL(10,2);

-- Set defaults for existing Expense rows: tax=0, tax_value=amount (no tax applied)
UPDATE "Expense" SET "tax" = 0, "tax_value" = "amount" WHERE "tax" IS NULL;

-- Make columns NOT NULL
ALTER TABLE "Expense" ALTER COLUMN "tax" SET NOT NULL,
ALTER COLUMN "tax_value" SET NOT NULL;

-- Set default for future inserts
ALTER TABLE "Expense" ALTER COLUMN "tax" SET DEFAULT 0,
ALTER COLUMN "tax_value" SET DEFAULT 0;

-- AlterTable: Add tax columns to Income (nullable first for existing rows)
ALTER TABLE "Income" ADD COLUMN "tax" DECIMAL(10,2),
ADD COLUMN "tax_value" DECIMAL(10,2);

-- Set defaults for existing Income rows: tax=0, tax_value=amount (no tax applied)
UPDATE "Income" SET "tax" = 0, "tax_value" = "amount" WHERE "tax" IS NULL;

-- Make columns NOT NULL
ALTER TABLE "Income" ALTER COLUMN "tax" SET NOT NULL,
ALTER COLUMN "tax_value" SET NOT NULL;

-- Set default for future inserts
ALTER TABLE "Income" ALTER COLUMN "tax" SET DEFAULT 0,
ALTER COLUMN "tax_value" SET DEFAULT 0;
