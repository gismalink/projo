-- AlterTable
ALTER TABLE "Role" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Department" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Grade" ADD COLUMN "companyId" TEXT;
ALTER TABLE "ProjectTeamTemplate" ADD COLUMN "companyId" TEXT;

-- DropIndex
DROP INDEX "Role_name_key";
DROP INDEX "Department_name_key";
DROP INDEX "Grade_name_key";
DROP INDEX "ProjectTeamTemplate_name_key";

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");
CREATE INDEX "Department_companyId_idx" ON "Department"("companyId");
CREATE INDEX "Grade_companyId_idx" ON "Grade"("companyId");
CREATE INDEX "ProjectTeamTemplate_companyId_idx" ON "ProjectTeamTemplate"("companyId");

-- Create unique composites
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");
CREATE UNIQUE INDEX "Department_companyId_name_key" ON "Department"("companyId", "name");
CREATE UNIQUE INDEX "Grade_companyId_name_key" ON "Grade"("companyId", "name");
CREATE UNIQUE INDEX "ProjectTeamTemplate_companyId_name_key" ON "ProjectTeamTemplate"("companyId", "name");

-- Foreign keys
ALTER TABLE "Role"
ADD CONSTRAINT "Role_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Department"
ADD CONSTRAINT "Department_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Grade"
ADD CONSTRAINT "Grade_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectTeamTemplate"
ADD CONSTRAINT "ProjectTeamTemplate_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
