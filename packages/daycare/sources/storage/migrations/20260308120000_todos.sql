CREATE TABLE "todos" (
    "id" text NOT NULL,
    "workspace_id" text NOT NULL,
    "parent_id" text,
    "title" text NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "status" text DEFAULT 'unstarted' NOT NULL,
    "rank" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "todos_workspace_id_id_version_pk" PRIMARY KEY("workspace_id","id","version"),
    CONSTRAINT "todos_status_valid" CHECK ("status" IN ('draft', 'unstarted', 'started', 'finished', 'abandoned'))
);

CREATE INDEX "idx_todos_workspace_parent_rank" ON "todos" ("workspace_id", "parent_id", "rank");
CREATE INDEX "idx_todos_workspace_valid_to" ON "todos" ("workspace_id", "valid_to");
