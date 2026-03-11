CREATE TABLE IF NOT EXISTS "mini_apps" (
    "user_id" text NOT NULL,
    "id" text NOT NULL,
    "version" integer NOT NULL DEFAULT 1,
    "code_version" integer NOT NULL DEFAULT 1,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "title" text NOT NULL,
    "icon" text NOT NULL,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "mini_apps_user_id_id_version_pk" PRIMARY KEY("user_id", "id", "version")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_mini_apps_user_id_active"
ON "mini_apps" ("user_id", "id")
WHERE "valid_to" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_mini_apps_user_id" ON "mini_apps" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_mini_apps_updated_at" ON "mini_apps" ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_mini_apps_id_valid_to" ON "mini_apps" ("id", "valid_to");
