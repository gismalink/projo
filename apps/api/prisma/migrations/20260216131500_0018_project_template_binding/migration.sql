-- AlterTable
ALTER TABLE "Project" ADD COLUMN "teamTemplateId" TEXT;

-- CreateIndex
CREATE INDEX "Project_teamTemplateId_idx" ON "Project"("teamTemplateId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_teamTemplateId_fkey" FOREIGN KEY ("teamTemplateId") REFERENCES "ProjectTeamTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Normalize default template role sets by canonical role names
DELETE FROM "ProjectTeamTemplateRole"
WHERE "templateId" IN (
	SELECT "id" FROM "ProjectTeamTemplate" WHERE "name" IN ('web proj', 'unity lab')
);

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
		('web proj', 'UI_DESIGNER', 1),
		('web proj', 'QA_ENGINEER', 2),
		('web proj', 'BACKEND_DEVELOPER', 3),
		('web proj', 'ANALYST', 4),
		('web proj', 'FRONTEND_DEVELOPER', 5),
		('unity lab', 'PM', 0),
		('unity lab', 'UI_DESIGNER', 1),
		('unity lab', 'UX_DESIGNER', 2),
		('unity lab', 'QA_ENGINEER', 3),
		('unity lab', 'ANALYST', 4),
		('unity lab', 'UNITY_DEVELOPER', 5),
		('unity lab', 'ARTIST_3D', 6)
) AS mapping("templateName", "roleName", "position")
JOIN "ProjectTeamTemplate" template ON template."name" = mapping."templateName"
JOIN "Role" role ON role."name" = mapping."roleName";
