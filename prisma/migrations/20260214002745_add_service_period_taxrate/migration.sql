-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "recurringPeriod" TEXT NOT NULL DEFAULT 'monthly',
ADD COLUMN     "taxRate" DECIMAL(5,2);
