-- CreateTable
CREATE TABLE "Grade" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Grade_name_key" ON "Grade"("name");

-- Seed default grades
INSERT INTO "Grade" ("id", "name", "createdAt", "updatedAt") VALUES
  ('cm0000000000000000000001', 'джу', NOW(), NOW()),
  ('cm0000000000000000000002', 'джун+', NOW(), NOW()),
  ('cm0000000000000000000003', 'мидл', NOW(), NOW()),
  ('cm0000000000000000000004', 'мидл+', NOW(), NOW()),
  ('cm0000000000000000000005', 'синьйор', NOW(), NOW()),
  ('cm0000000000000000000006', 'синьйор+', NOW(), NOW()),
  ('cm0000000000000000000007', 'лид', NOW(), NOW()),
  ('cm0000000000000000000008', 'рук-отдела', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;
