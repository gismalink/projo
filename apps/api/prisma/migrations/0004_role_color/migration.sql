-- AlterTable
ALTER TABLE "Role" ADD COLUMN "colorHex" VARCHAR(7);

-- Seed default colors for core IT roles
UPDATE "Role" SET "colorHex" = '#5B8DEF' WHERE "name" = 'BACKEND_DEVELOPER' AND "colorHex" IS NULL;
UPDATE "Role" SET "colorHex" = '#9B8AFB' WHERE "name" = 'UNITY_DEVELOPER' AND "colorHex" IS NULL;
UPDATE "Role" SET "colorHex" = '#46B7D6' WHERE "name" = 'UI_DESIGNER' AND "colorHex" IS NULL;
UPDATE "Role" SET "colorHex" = '#31B28D' WHERE "name" = 'UX_DESIGNER' AND "colorHex" IS NULL;
UPDATE "Role" SET "colorHex" = '#E6A23C' WHERE "name" = 'ANALYST' AND "colorHex" IS NULL;
UPDATE "Role" SET "colorHex" = '#F06A8A' WHERE "name" = 'QA_ENGINEER' AND "colorHex" IS NULL;
UPDATE "Role" SET "colorHex" = '#6E7B8A' WHERE "name" IN ('ADMIN','PM','VIEWER','FINANCE') AND "colorHex" IS NULL;
