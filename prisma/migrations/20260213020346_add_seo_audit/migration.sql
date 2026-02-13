-- CreateTable
CREATE TABLE "SeoAudit" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "language" TEXT NOT NULL DEFAULT 'en',
    "urls" JSONB NOT NULL,
    "progress" JSONB,
    "results" JSONB,
    "summary" JSONB,
    "pdfPath" TEXT,
    "error" TEXT,
    "createdById" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeoAudit_createdById_idx" ON "SeoAudit"("createdById");

-- CreateIndex
CREATE INDEX "SeoAudit_status_idx" ON "SeoAudit"("status");

-- CreateIndex
CREATE INDEX "SeoAudit_createdAt_idx" ON "SeoAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "SeoAudit" ADD CONSTRAINT "SeoAudit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
