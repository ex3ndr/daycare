DROP INDEX IF EXISTS "idx_users_single_owner";

ALTER TABLE "users"
DROP COLUMN IF EXISTS "is_owner";
