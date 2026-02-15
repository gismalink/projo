-- AlterTable
ALTER TABLE "Department" ADD COLUMN "colorHex" VARCHAR(7);

-- Backfill defaults for existing departments
UPDATE "Department" SET "colorHex" = '#7A8A9A' WHERE "name" = 'Production' AND "colorHex" IS NULL;
UPDATE "Department" SET "colorHex" = '#9B7BFF' WHERE "name" = 'Design' AND "colorHex" IS NULL;
UPDATE "Department" SET "colorHex" = '#38A169' WHERE "name" = 'QA' AND "colorHex" IS NULL;
UPDATE "Department" SET "colorHex" = '#D69E2E' WHERE "name" = 'Analytics' AND "colorHex" IS NULL;
UPDATE "Department" SET "colorHex" = '#E76F51' WHERE "name" = 'Management' AND "colorHex" IS NULL;
