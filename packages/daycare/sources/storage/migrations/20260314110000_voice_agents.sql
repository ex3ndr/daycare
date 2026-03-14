CREATE TABLE "voice_agents" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "system_prompt" text NOT NULL,
    "tools" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL
);

CREATE INDEX "idx_voice_agents_user_id" ON "voice_agents" USING btree ("user_id");
CREATE INDEX "idx_voice_agents_updated_at" ON "voice_agents" USING btree ("updated_at");
