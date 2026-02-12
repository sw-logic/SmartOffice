-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "parentId" INTEGER,
ADD COLUMN     "recurringEndDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Income" ADD COLUMN     "parentId" INTEGER,
ADD COLUMN     "recurringEndDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Expense_parentId_idx" ON "Expense"("parentId");

-- CreateIndex
CREATE INDEX "Income_parentId_idx" ON "Income"("parentId");

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Income"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
