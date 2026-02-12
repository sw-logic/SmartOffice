/*
  Warnings:

  - You are about to drop the column `offerId` on the `OfferItem` table. All the data in the column will be lost.
  - Added the required column `optionId` to the `OfferItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_clientId_fkey";

-- DropForeignKey
ALTER TABLE "OfferItem" DROP CONSTRAINT "OfferItem_offerId_fkey";

-- DropIndex
DROP INDEX "OfferItem_offerId_idx";

-- AlterTable
ALTER TABLE "KanbanColumn" ADD COLUMN     "isCompleteColumn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "clientAddress" TEXT,
ADD COLUMN     "clientCompanyName" TEXT,
ADD COLUMN     "clientEmail" TEXT,
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "discountType" TEXT,
ADD COLUMN     "discountValue" DECIMAL(10,2),
ALTER COLUMN "clientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OfferItem" DROP COLUMN "offerId",
ADD COLUMN     "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "optionId" INTEGER NOT NULL,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "unitOfMeasure" TEXT NOT NULL DEFAULT 'piece';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "isComplete" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OfferOption" (
    "id" SERIAL NOT NULL,
    "offerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfferOption_offerId_idx" ON "OfferOption"("offerId");

-- CreateIndex
CREATE INDEX "OfferItem_optionId_idx" ON "OfferItem"("optionId");

-- CreateIndex
CREATE INDEX "Task_isComplete_idx" ON "Task"("isComplete");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferOption" ADD CONSTRAINT "OfferOption_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "OfferOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: set isComplete = true for tasks with status 'done'
UPDATE "Task" SET "isComplete" = true WHERE "status" = 'done';

-- Backfill: set isCompleteColumn = true for columns named 'Done' (case-insensitive)
UPDATE "KanbanColumn" SET "isCompleteColumn" = true WHERE LOWER("name") = 'done';
