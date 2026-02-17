-- CreateTable
CREATE TABLE "Company" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "companyId" TEXT;

-- CreateIndex
CREATE INDEX "Company_ownerUserId_idx" ON "Company"("ownerUserId");

-- CreateIndex
CREATE INDEX "Workspace_companyId_idx" ON "Workspace"("companyId");

-- AddForeignKey
ALTER TABLE "Company"
ADD CONSTRAINT "Company_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace"
ADD CONSTRAINT "Workspace_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
