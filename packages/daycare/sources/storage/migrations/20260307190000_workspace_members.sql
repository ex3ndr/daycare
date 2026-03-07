CREATE TABLE "workspace_members" (
    "id" serial PRIMARY KEY NOT NULL,
    "workspace_id" text NOT NULL,
    "user_id" text NOT NULL,
    "joined_at" bigint NOT NULL,
    "left_at" bigint,
    "kick_reason" text
);

CREATE UNIQUE INDEX "workspace_members_workspace_user_unique" ON "workspace_members" ("workspace_id", "user_id");
CREATE INDEX "idx_workspace_members_workspace" ON "workspace_members" ("workspace_id");
CREATE INDEX "idx_workspace_members_user" ON "workspace_members" ("user_id");
CREATE INDEX "idx_workspace_members_active_workspace" ON "workspace_members" ("workspace_id", "joined_at")
    WHERE "left_at" IS NULL;
CREATE INDEX "idx_workspace_members_active_user" ON "workspace_members" ("user_id", "joined_at")
    WHERE "left_at" IS NULL;
