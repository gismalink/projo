WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "projectId", "employeeId"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
    ) AS row_num
  FROM "ProjectAssignment"
)
DELETE FROM "ProjectAssignment" pa
USING ranked
WHERE pa.id = ranked.id
  AND ranked.row_num > 1;

CREATE UNIQUE INDEX "ProjectAssignment_projectId_employeeId_key"
ON "ProjectAssignment"("projectId", "employeeId");
