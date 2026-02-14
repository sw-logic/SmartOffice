-- CreateTable
CREATE TABLE "HostingSite" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "wpVersion" TEXT,
    "phpVersion" TEXT,
    "coreUpdate" BOOLEAN NOT NULL DEFAULT false,
    "pluginUpdates" INTEGER NOT NULL DEFAULT 0,
    "themeUpdates" INTEGER NOT NULL DEFAULT 0,
    "totalUpdates" INTEGER NOT NULL DEFAULT 0,
    "activePlugins" INTEGER NOT NULL DEFAULT 0,
    "lastSyncData" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "serviceId" INTEGER,
    "clientId" INTEGER,
    "clientName" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostingSite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HostingSite_serviceId_idx" ON "HostingSite"("serviceId");

-- CreateIndex
CREATE INDEX "HostingSite_clientId_idx" ON "HostingSite"("clientId");

-- CreateIndex
CREATE INDEX "HostingSite_status_idx" ON "HostingSite"("status");

-- AddForeignKey
ALTER TABLE "HostingSite" ADD CONSTRAINT "HostingSite_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostingSite" ADD CONSTRAINT "HostingSite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostingSite" ADD CONSTRAINT "HostingSite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
