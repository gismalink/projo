-- Rename access role enum value to avoid collision with employee/job role names.
-- Postgres enum value rename keeps existing rows valid.

ALTER TYPE "AppRole" RENAME VALUE 'PM' TO 'EDITOR';
