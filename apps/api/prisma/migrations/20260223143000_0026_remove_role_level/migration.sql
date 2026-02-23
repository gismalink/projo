-- Remove role level field (was unused and confusing).

ALTER TABLE "Role" DROP COLUMN IF EXISTS "level";
