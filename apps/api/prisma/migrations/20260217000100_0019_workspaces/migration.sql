-- AlterTable
ALTER TABLE "User" ADD COLUMN "activeWorkspaceId" TEXT;

-- CreateTable
CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "AppRole" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_activeWorkspaceId_idx" ON "User"("activeWorkspaceId");

-- CreateIndex
CREATE INDEX "Workspace_ownerUserId_idx" ON "Workspace"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_idx" ON "WorkspaceMember"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeWorkspaceId_fkey" FOREIGN KEY ("activeWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill default workspace and membership per existing user
INSERT INTO "Workspace" ("id", "name", "ownerUserId", "createdAt", "updatedAt")
SELECT
  CONCAT('ws_', SUBSTR(md5(u."id"), 1, 20)),
  CONCAT(COALESCE(NULLIF(TRIM(u."fullName"), ''), 'Personal'), ' workspace'),
  u."id",
  NOW(),
  NOW()
FROM "User" u
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "createdAt", "updatedAt")
SELECT
  CONCAT('wsm_', SUBSTR(md5(u."id" || ':member'), 1, 20)),
  CONCAT('ws_', SUBSTR(md5(u."id"), 1, 20)),
  u."id",
  u."appRole",
  NOW(),
  NOW()
FROM "User" u
ON CONFLICT ("workspaceId", "userId") DO NOTHING;

UPDATE "User" u
SET "activeWorkspaceId" = CONCAT('ws_', SUBSTR(md5(u."id"), 1, 20))
WHERE u."activeWorkspaceId" IS NULL;

-- Scope employees and projects to active workspace
ALTER TABLE "Employee" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Project" ADD COLUMN "workspaceId" TEXT;

UPDATE "Employee" e
SET "workspaceId" = u."activeWorkspaceId"
FROM "User" u
WHERE u."email" = e."email" AND e."workspaceId" IS NULL;

UPDATE "Employee" e
SET "workspaceId" = (
  SELECT "id"
  FROM "Workspace"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE e."workspaceId" IS NULL;

UPDATE "Project" p
SET "workspaceId" = (
  SELECT "id"
  FROM "Workspace"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE p."workspaceId" IS NULL;

ALTER TABLE "Employee" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "workspaceId" SET NOT NULL;

DROP INDEX IF EXISTS "Employee_email_key";
DROP INDEX IF EXISTS "Project_code_key";

CREATE UNIQUE INDEX "Employee_workspaceId_email_key" ON "Employee"("workspaceId", "email");
CREATE INDEX "Employee_workspaceId_idx" ON "Employee"("workspaceId");
CREATE UNIQUE INDEX "Project_workspaceId_code_key" ON "Project"("workspaceId", "code");
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
