-- AlterTable
ALTER TABLE "EnumType" ADD COLUMN     "group" TEXT NOT NULL DEFAULT 'Generic';

-- CreateIndex
CREATE INDEX "EnumType_group_idx" ON "EnumType"("group");
