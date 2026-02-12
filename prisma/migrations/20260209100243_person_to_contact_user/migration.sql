/*
  Warnings:

  - The primary key for the `KanbanBoardMember` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `personId` on the `KanbanBoardMember` table. All the data in the column will be lost.
  - The `authorId` column on the `Note` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `ProjectEmployee` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `personId` on the `ProjectEmployee` table. All the data in the column will be lost.
  - You are about to drop the column `personId` on the `TimeRecord` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `UserGroupUser` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `Person` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `userId` on the `Account` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `userId` on the `AuditLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdById` on the `Client` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdById` on the `Expense` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdById` on the `Income` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `userId` to the `KanbanBoardMember` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `createdById` on the `Offer` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdById` on the `Payment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdById` on the `Project` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `userId` to the `ProjectEmployee` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `userId` on the `Session` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdById` on the `Task` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdById` on the `TimeRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `userId` on the `UserBoardPreference` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `userId` on the `UserGroupUser` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Income" DROP CONSTRAINT "Income_createdById_fkey";

-- DropForeignKey
ALTER TABLE "KanbanBoardMember" DROP CONSTRAINT "KanbanBoardMember_personId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Person" DROP CONSTRAINT "Person_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Person" DROP CONSTRAINT "Person_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Person" DROP CONSTRAINT "Person_userId_fkey";

-- DropForeignKey
ALTER TABLE "Person" DROP CONSTRAINT "Person_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_projectManagerId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectEmployee" DROP CONSTRAINT "ProjectEmployee_personId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_createdById_fkey";

-- DropForeignKey
ALTER TABLE "TimeRecord" DROP CONSTRAINT "TimeRecord_createdById_fkey";

-- DropForeignKey
ALTER TABLE "TimeRecord" DROP CONSTRAINT "TimeRecord_personId_fkey";

-- DropForeignKey
ALTER TABLE "UserBoardPreference" DROP CONSTRAINT "UserBoardPreference_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserGroupUser" DROP CONSTRAINT "UserGroupUser_userId_fkey";

-- DropIndex
DROP INDEX "TimeRecord_personId_idx";

-- AlterTable
ALTER TABLE "Account" DROP COLUMN "userId",
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "userId",
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "createdById",
ADD COLUMN     "createdById" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "createdById",
ADD COLUMN     "createdById" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Income" DROP COLUMN "createdById",
ADD COLUMN     "createdById" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "KanbanBoardMember" DROP CONSTRAINT "KanbanBoardMember_pkey",
DROP COLUMN "personId",
ADD COLUMN     "userId" INTEGER NOT NULL,
ADD CONSTRAINT "KanbanBoardMember_pkey" PRIMARY KEY ("kanbanBoardId", "userId");

-- AlterTable
ALTER TABLE "Note" DROP COLUMN "authorId",
ADD COLUMN     "authorId" INTEGER;

-- AlterTable
ALTER TABLE "Offer" DROP COLUMN "createdById",
ADD COLUMN     "createdById" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "createdById",
ADD COLUMN     "createdById" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "createdById",
ADD COLUMN     "createdById" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ProjectEmployee" DROP CONSTRAINT "ProjectEmployee_pkey",
DROP COLUMN "personId",
ADD COLUMN     "userId" INTEGER NOT NULL,
ADD CONSTRAINT "ProjectEmployee_pkey" PRIMARY KEY ("projectId", "userId");

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "userId",
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "createdById",
ADD COLUMN     "createdById" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "TimeRecord" DROP COLUMN "personId",
ADD COLUMN     "userId" INTEGER,
DROP COLUMN "createdById",
ADD COLUMN     "createdById" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "companyId" INTEGER,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "department" TEXT,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "employeeStatus" TEXT,
ADD COLUMN     "employmentType" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "hireDate" TIMESTAMP(3),
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "salary" DECIMAL(10,2),
ADD COLUMN     "salary_bonus" DECIMAL(10,2),
ADD COLUMN     "salary_tax" DECIMAL(10,2),
ADD COLUMN     "street" TEXT,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "UserBoardPreference" DROP COLUMN "userId",
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "UserGroupUser" DROP CONSTRAINT "UserGroupUser_pkey",
DROP COLUMN "userId",
ADD COLUMN     "userId" INTEGER NOT NULL,
ADD CONSTRAINT "UserGroupUser_pkey" PRIMARY KEY ("userId", "userGroupId");

-- DropTable
DROP TABLE "Person";

-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "position" TEXT,
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "clientId" INTEGER,
    "vendorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_clientId_idx" ON "Contact"("clientId");

-- CreateIndex
CREATE INDEX "Contact_vendorId_idx" ON "Contact"("vendorId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Note_authorId_idx" ON "Note"("authorId");

-- CreateIndex
CREATE INDEX "TimeRecord_createdById_idx" ON "TimeRecord"("createdById");

-- CreateIndex
CREATE INDEX "TimeRecord_userId_idx" ON "TimeRecord"("userId");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_employeeStatus_idx" ON "User"("employeeStatus");

-- CreateIndex
CREATE UNIQUE INDEX "UserBoardPreference_userId_kanbanBoardId_key" ON "UserBoardPreference"("userId", "kanbanBoardId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroupUser" ADD CONSTRAINT "UserGroupUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEmployee" ADD CONSTRAINT "ProjectEmployee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeRecord" ADD CONSTRAINT "TimeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeRecord" ADD CONSTRAINT "TimeRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KanbanBoardMember" ADD CONSTRAINT "KanbanBoardMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBoardPreference" ADD CONSTRAINT "UserBoardPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
