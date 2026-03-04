CREATE TABLE IF NOT EXISTS "fragments" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "kit_version" text NOT NULL,
    "title" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "spec" jsonb NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "fragments_user_id_id_version_pk" PRIMARY KEY("user_id", "id", "version")
);

CREATE INDEX IF NOT EXISTS "idx_fragments_user_id" ON "fragments" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_fragments_id_valid_to" ON "fragments" ("id", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_fragments_updated_at" ON "fragments" ("updated_at");
