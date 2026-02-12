-- AlterTable
ALTER TABLE "Offer" ADD COLUMN "title" TEXT;
ALTER TABLE "Offer" ADD COLUMN "showGrandTotal" BOOLEAN NOT NULL DEFAULT true;
