-- AlterTable
ALTER TABLE "TimeRecord" ADD COLUMN     "billable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "personId" INTEGER;

-- CreateIndex
CREATE INDEX "TimeRecord_personId_idx" ON "TimeRecord"("personId");

-- AddForeignKey
ALTER TABLE "TimeRecord" ADD CONSTRAINT "TimeRecord_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
