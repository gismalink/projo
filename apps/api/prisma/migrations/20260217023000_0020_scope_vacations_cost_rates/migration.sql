-- Scope vacations and cost rates by workspace

-- Vacation
ALTER TABLE "Vacation" ADD COLUMN "workspaceId" TEXT;

UPDATE "Vacation" v
SET "workspaceId" = e."workspaceId"
FROM "Employee" e
WHERE e."id" = v."employeeId" AND v."workspaceId" IS NULL;

UPDATE "Vacation" v
SET "workspaceId" = (
  SELECT "id"
  FROM "Workspace"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE v."workspaceId" IS NULL;

ALTER TABLE "Vacation" ALTER COLUMN "workspaceId" SET NOT NULL;
CREATE INDEX "Vacation_workspaceId_startDate_endDate_idx" ON "Vacation"("workspaceId", "startDate", "endDate");
ALTER TABLE "Vacation" ADD CONSTRAINT "Vacation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CostRate
ALTER TABLE "CostRate" ADD COLUMN "workspaceId" TEXT;

UPDATE "CostRate" c
SET "workspaceId" = e."workspaceId"
FROM "Employee" e
WHERE e."id" = c."employeeId" AND c."workspaceId" IS NULL;

UPDATE "CostRate" c
SET "workspaceId" = (
  SELECT "id"
  FROM "Workspace"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE c."workspaceId" IS NULL;

ALTER TABLE "CostRate" ALTER COLUMN "workspaceId" SET NOT NULL;
DROP INDEX IF EXISTS "CostRate_employeeId_validFrom_idx";
DROP INDEX IF EXISTS "CostRate_roleId_validFrom_idx";
CREATE INDEX "CostRate_workspaceId_employeeId_validFrom_idx" ON "CostRate"("workspaceId", "employeeId", "validFrom");
CREATE INDEX "CostRate_workspaceId_roleId_validFrom_idx" ON "CostRate"("workspaceId", "roleId", "validFrom");
ALTER TABLE "CostRate" ADD CONSTRAINT "CostRate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
