CREATE TABLE IF NOT EXISTS "psql_databases" (
    "user_id" text NOT NULL,
    "id" text NOT NULL,
    "name" text NOT NULL,
    "created_at" bigint NOT NULL,
    CONSTRAINT "psql_databases_user_id_id_pk" PRIMARY KEY("user_id", "id")
);

CREATE INDEX IF NOT EXISTS "idx_psql_databases_user_created" ON "psql_databases" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_psql_databases_user_name" ON "psql_databases" ("user_id", "name");
