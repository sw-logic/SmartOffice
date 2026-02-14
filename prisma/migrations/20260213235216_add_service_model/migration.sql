-- AlterTable
ALTER TABLE "TimeRecord" ADD COLUMN     "serviceId" INTEGER,
ALTER COLUMN "taskId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Service" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "clientId" INTEGER,
    "clientName" TEXT,
    "contactId" INTEGER,
    "contactName" TEXT,
    "assignedToId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "monthlyFee" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'HUF',
    "budgetedHours" INTEGER,
    "spentTime" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "incomeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_incomeId_key" ON "Service"("incomeId");

-- CreateIndex
CREATE INDEX "Service_clientId_idx" ON "Service"("clientId");

-- CreateIndex
CREATE INDEX "Service_assignedToId_idx" ON "Service"("assignedToId");

-- CreateIndex
CREATE INDEX "Service_status_idx" ON "Service"("status");

-- CreateIndex
CREATE INDEX "TimeRecord_serviceId_idx" ON "TimeRecord"("serviceId");

-- AddForeignKey
ALTER TABLE "TimeRecord" ADD CONSTRAINT "TimeRecord_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "Income"("id") ON DELETE SET NULL ON UPDATE CASCADE;
