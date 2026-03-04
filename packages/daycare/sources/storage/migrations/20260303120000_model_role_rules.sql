CREATE TABLE "model_role_rules" (
    "id" text PRIMARY KEY,
    "role" text,
    "kind" text,
    "user_id" text,
    "agent_id" text,
    "model" text NOT NULL,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL
);

CREATE INDEX "idx_model_role_rules_role" ON "model_role_rules" ("role");
CREATE INDEX "idx_model_role_rules_kind" ON "model_role_rules" ("kind");
CREATE INDEX "idx_model_role_rules_user_id" ON "model_role_rules" ("user_id");
CREATE INDEX "idx_model_role_rules_agent_id" ON "model_role_rules" ("agent_id");
