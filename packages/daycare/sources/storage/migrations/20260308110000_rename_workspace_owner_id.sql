DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'parent_user_id'
    ) THEN
        ALTER TABLE "users" RENAME COLUMN "parent_user_id" TO "workspace_owner_id";
    END IF;
END $$;

DROP INDEX IF EXISTS "idx_users_parent";
CREATE INDEX IF NOT EXISTS "idx_users_workspace_owner"
    ON "users" USING btree ("workspace_owner_id")
    WHERE "users"."workspace_owner_id" IS NOT NULL;
