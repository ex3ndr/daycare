ALTER TABLE users ADD COLUMN IF NOT EXISTS is_swarm integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS about text;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS system_prompt text;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS memory integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "swarm_contacts" (
	"swarm_user_id" text NOT NULL,
	"contact_agent_id" text NOT NULL,
	"swarm_agent_id" text NOT NULL,
	"messages_sent" integer DEFAULT 0 NOT NULL,
	"messages_received" integer DEFAULT 0 NOT NULL,
	"first_contact_at" bigint NOT NULL,
	"last_contact_at" bigint NOT NULL,
	CONSTRAINT "swarm_contacts_swarm_user_id_contact_agent_id_pk" PRIMARY KEY("swarm_user_id", "contact_agent_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_swarm_contacts_swarm_user_id" ON "swarm_contacts" USING btree ("swarm_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_swarm_contacts_swarm_agent_id" ON "swarm_contacts" USING btree ("swarm_agent_id");
--> statement-breakpoint
DO $$
BEGIN
    IF to_regclass('public.swarm_configs') IS NOT NULL THEN
        UPDATE users AS u
        SET
            is_swarm = 1,
            first_name = COALESCE(u.first_name, sc.title),
            bio = COALESCE(u.bio, sc.description),
            about = COALESCE(u.about, sc.title),
            system_prompt = COALESCE(u.system_prompt, sc.system_prompt),
            memory = sc.memory,
            updated_at = GREATEST(COALESCE(u.updated_at, 0), sc.updated_at)
        FROM swarm_configs AS sc
        WHERE u.id = sc.user_id;
    END IF;
END
$$;
--> statement-breakpoint
DROP INDEX IF EXISTS idx_swarm_configs_owner_user_id;
--> statement-breakpoint
DROP INDEX IF EXISTS idx_swarm_configs_owner_name;
--> statement-breakpoint
DROP TABLE IF EXISTS swarm_configs;
--> statement-breakpoint
ALTER TABLE users DROP COLUMN IF EXISTS name;
