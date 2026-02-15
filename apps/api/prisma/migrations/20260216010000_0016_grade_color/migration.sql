-- AlterTable
ALTER TABLE "Grade" ADD COLUMN "colorHex" VARCHAR(7);

-- Backfill grade colors
UPDATE "Grade" SET "colorHex" = '#6EC1FF' WHERE "name" = 'джу' AND "colorHex" IS NULL;
UPDATE "Grade" SET "colorHex" = '#4FA3FF' WHERE "name" = 'джун+' AND "colorHex" IS NULL;
UPDATE "Grade" SET "colorHex" = '#7ED321' WHERE "name" = 'мидл' AND "colorHex" IS NULL;
UPDATE "Grade" SET "colorHex" = '#5FAF2A' WHERE "name" = 'мидл+' AND "colorHex" IS NULL;
UPDATE "Grade" SET "colorHex" = '#B57BFF' WHERE "name" = 'синьйор' AND "colorHex" IS NULL;
UPDATE "Grade" SET "colorHex" = '#9B59FF' WHERE "name" = 'синьйор+' AND "colorHex" IS NULL;
UPDATE "Grade" SET "colorHex" = '#FF8A4C' WHERE "name" = 'лид' AND "colorHex" IS NULL;
UPDATE "Grade" SET "colorHex" = '#FF5C5C' WHERE "name" = 'рук-отдела' AND "colorHex" IS NULL;
