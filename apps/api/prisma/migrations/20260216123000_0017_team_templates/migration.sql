-- CreateTable
CREATE TABLE "ProjectTeamTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTeamTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTeamTemplateRole" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTeamTemplateRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTeamTemplate_name_key" ON "ProjectTeamTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTeamTemplateRole_templateId_roleId_key" ON "ProjectTeamTemplateRole"("templateId", "roleId");

-- CreateIndex
CREATE INDEX "ProjectTeamTemplateRole_templateId_position_idx" ON "ProjectTeamTemplateRole"("templateId", "position");

-- CreateIndex
CREATE INDEX "ProjectTeamTemplateRole_roleId_idx" ON "ProjectTeamTemplateRole"("roleId");

-- AddForeignKey
ALTER TABLE "ProjectTeamTemplateRole" ADD CONSTRAINT "ProjectTeamTemplateRole_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProjectTeamTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeamTemplateRole" ADD CONSTRAINT "ProjectTeamTemplateRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ensure FRONT role exists for web templates
INSERT INTO "Role" ("id", "name", "shortName", "description", "level", "colorHex", "createdAt", "updatedAt")
SELECT
  CONCAT('role_', substr(md5(random()::text || clock_timestamp()::text), 1, 20)),
  'FRONTEND_DEVELOPER',
  'FRONT',
  'Frontend developer',
  3,
  '#4C9F70',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Role" WHERE "name" = 'FRONTEND_DEVELOPER'
);

-- Seed default templates
INSERT INTO "ProjectTeamTemplate" ("id", "name", "createdAt", "updatedAt")
VALUES
  (CONCAT('tmpl_', substr(md5(random()::text || clock_timestamp()::text), 1, 20)), 'web proj', NOW(), NOW()),
  (CONCAT('tmpl_', substr(md5(random()::text || clock_timestamp()::text), 1, 20)), 'unity lab', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "ProjectTeamTemplateRole" ("id", "templateId", "roleId", "position", "createdAt", "updatedAt")
SELECT
  CONCAT('tmpr_', substr(md5(random()::text || clock_timestamp()::text), 1, 20)),
  template."id",
  role."id",
  mapping."position",
  NOW(),
  NOW()
FROM (
  VALUES
    ('web proj', 'PM', 0),
    ('web proj', 'UI', 1),
    ('web proj', 'QA', 2),
    ('web proj', 'BACK', 3),
    ('web proj', 'ANLST', 4),
    ('web proj', 'FRONT', 5),
    ('unity lab', 'PM', 0),
    ('unity lab', 'UI', 1),
    ('unity lab', 'UX', 2),
    ('unity lab', 'QA', 3),
    ('unity lab', 'ANLST', 4),
    ('unity lab', 'UNITY', 5),
    ('unity lab', '3DART', 6)
) AS mapping("templateName", "roleShortName", "position")
JOIN "ProjectTeamTemplate" template ON template."name" = mapping."templateName"
JOIN "Role" role ON role."shortName" = mapping."roleShortName"
ON CONFLICT ("templateId", "roleId") DO NOTHING;
