ALTER TABLE "mini_apps"
ADD COLUMN IF NOT EXISTS "code_version" integer NOT NULL DEFAULT 1;

UPDATE "mini_apps"
SET "code_version" = "version";
