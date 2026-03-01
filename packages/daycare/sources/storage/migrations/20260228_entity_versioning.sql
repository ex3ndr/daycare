ALTER TABLE users ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS valid_from bigint;
ALTER TABLE users ADD COLUMN IF NOT EXISTS valid_to bigint;
--> statement-breakpoint
ALTER TABLE agents ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS valid_from bigint;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS valid_to bigint;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS valid_from bigint;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS valid_to bigint;
--> statement-breakpoint
ALTER TABLE tasks_cron ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE tasks_cron ADD COLUMN IF NOT EXISTS valid_from bigint;
ALTER TABLE tasks_cron ADD COLUMN IF NOT EXISTS valid_to bigint;
--> statement-breakpoint
ALTER TABLE tasks_heartbeat ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE tasks_heartbeat ADD COLUMN IF NOT EXISTS valid_from bigint;
ALTER TABLE tasks_heartbeat ADD COLUMN IF NOT EXISTS valid_to bigint;
--> statement-breakpoint
ALTER TABLE tasks_webhook ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE tasks_webhook ADD COLUMN IF NOT EXISTS valid_from bigint;
ALTER TABLE tasks_webhook ADD COLUMN IF NOT EXISTS valid_to bigint;
--> statement-breakpoint
ALTER TABLE signals_subscriptions ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE signals_subscriptions ADD COLUMN IF NOT EXISTS valid_from bigint;
ALTER TABLE signals_subscriptions ADD COLUMN IF NOT EXISTS valid_to bigint;
--> statement-breakpoint
ALTER TABLE channels ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS valid_from bigint;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS valid_to bigint;
--> statement-breakpoint
ALTER TABLE expose_endpoints ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE expose_endpoints ADD COLUMN IF NOT EXISTS valid_from bigint;
ALTER TABLE expose_endpoints ADD COLUMN IF NOT EXISTS valid_to bigint;
--> statement-breakpoint
ALTER TABLE processes ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE processes ADD COLUMN IF NOT EXISTS valid_from bigint;
ALTER TABLE processes ADD COLUMN IF NOT EXISTS valid_to bigint;
--> statement-breakpoint
ALTER TABLE connections ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE connections ADD COLUMN IF NOT EXISTS valid_from bigint;
ALTER TABLE connections ADD COLUMN IF NOT EXISTS valid_to bigint;
--> statement-breakpoint
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS valid_from bigint;
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS valid_to bigint;
--> statement-breakpoint
UPDATE users SET version = 1, valid_from = created_at, valid_to = NULL WHERE version IS NULL OR valid_from IS NULL;
UPDATE agents SET version = 1, valid_from = created_at, valid_to = NULL WHERE version IS NULL OR valid_from IS NULL;
UPDATE tasks
SET
    version = 1,
    valid_from = created_at,
    valid_to = CASE
        WHEN deleted_at IS NOT NULL THEN deleted_at
        ELSE NULL
    END
WHERE version IS NULL OR valid_from IS NULL;
UPDATE tasks_cron SET version = 1, valid_from = created_at, valid_to = NULL WHERE version IS NULL OR valid_from IS NULL;
UPDATE tasks_heartbeat SET version = 1, valid_from = created_at, valid_to = NULL WHERE version IS NULL OR valid_from IS NULL;
UPDATE tasks_webhook SET version = 1, valid_from = created_at, valid_to = NULL WHERE version IS NULL OR valid_from IS NULL;
UPDATE signals_subscriptions SET version = 1, valid_from = created_at, valid_to = NULL WHERE version IS NULL OR valid_from IS NULL;
UPDATE channels SET version = 1, valid_from = created_at, valid_to = NULL WHERE version IS NULL OR valid_from IS NULL;
UPDATE expose_endpoints SET version = 1, valid_from = created_at, valid_to = NULL WHERE version IS NULL OR valid_from IS NULL;
UPDATE processes SET version = 1, valid_from = created_at, valid_to = NULL WHERE version IS NULL OR valid_from IS NULL;
UPDATE connections
SET
    version = 1,
    valid_from = COALESCE(requested_a_at, requested_b_at, 0),
    valid_to = NULL
WHERE version IS NULL OR valid_from IS NULL;
UPDATE system_prompts SET version = 1, valid_from = created_at, valid_to = NULL WHERE version IS NULL OR valid_from IS NULL;
--> statement-breakpoint
ALTER TABLE users ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE users ALTER COLUMN version SET NOT NULL;
ALTER TABLE users ALTER COLUMN valid_from SET NOT NULL;
ALTER TABLE agents ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE agents ALTER COLUMN version SET NOT NULL;
ALTER TABLE agents ALTER COLUMN valid_from SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE tasks ALTER COLUMN version SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN valid_from SET NOT NULL;
ALTER TABLE tasks_cron ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE tasks_cron ALTER COLUMN version SET NOT NULL;
ALTER TABLE tasks_cron ALTER COLUMN valid_from SET NOT NULL;
ALTER TABLE tasks_heartbeat ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE tasks_heartbeat ALTER COLUMN version SET NOT NULL;
ALTER TABLE tasks_heartbeat ALTER COLUMN valid_from SET NOT NULL;
ALTER TABLE tasks_webhook ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE tasks_webhook ALTER COLUMN version SET NOT NULL;
ALTER TABLE tasks_webhook ALTER COLUMN valid_from SET NOT NULL;
ALTER TABLE signals_subscriptions ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE signals_subscriptions ALTER COLUMN version SET NOT NULL;
ALTER TABLE signals_subscriptions ALTER COLUMN valid_from SET NOT NULL;
ALTER TABLE channels ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE channels ALTER COLUMN version SET NOT NULL;
ALTER TABLE channels ALTER COLUMN valid_from SET NOT NULL;
ALTER TABLE expose_endpoints ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE expose_endpoints ALTER COLUMN version SET NOT NULL;
ALTER TABLE expose_endpoints ALTER COLUMN valid_from SET NOT NULL;
ALTER TABLE processes ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE processes ALTER COLUMN version SET NOT NULL;
ALTER TABLE processes ALTER COLUMN valid_from SET NOT NULL;
ALTER TABLE connections ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE connections ALTER COLUMN version SET NOT NULL;
ALTER TABLE connections ALTER COLUMN valid_from SET NOT NULL;
ALTER TABLE system_prompts ALTER COLUMN version SET DEFAULT 1;
ALTER TABLE system_prompts ALTER COLUMN version SET NOT NULL;
ALTER TABLE system_prompts ALTER COLUMN valid_from SET NOT NULL;
--> statement-breakpoint
ALTER TABLE user_connector_keys DROP CONSTRAINT IF EXISTS user_connector_keys_user_id_users_id_fk;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_agent_id_agents_id_fk;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_parent_user_id_users_id_fk;
ALTER TABLE tasks_cron DROP CONSTRAINT IF EXISTS tasks_cron_user_id_task_id_tasks_user_id_id_fk;
ALTER TABLE tasks_heartbeat DROP CONSTRAINT IF EXISTS tasks_heartbeat_user_id_task_id_tasks_user_id_id_fk;
ALTER TABLE tasks_webhook DROP CONSTRAINT IF EXISTS tasks_webhook_user_id_task_id_tasks_user_id_id_fk;
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_user_a_id_users_id_fk;
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_user_b_id_users_id_fk;
ALTER TABLE token_stats_hourly DROP CONSTRAINT IF EXISTS token_stats_hourly_user_id_users_id_fk;
ALTER TABLE token_stats_hourly DROP CONSTRAINT IF EXISTS token_stats_hourly_agent_id_agents_id_fk;
ALTER TABLE channel_members DROP CONSTRAINT IF EXISTS channel_members_channel_id_channels_id_fk;
ALTER TABLE channel_messages DROP CONSTRAINT IF EXISTS channel_messages_channel_id_channels_id_fk;
--> statement-breakpoint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id, version);
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_pkey;
ALTER TABLE agents ADD CONSTRAINT agents_pkey PRIMARY KEY (id, version);
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_user_id_id_pk;
ALTER TABLE tasks ADD CONSTRAINT tasks_user_id_id_pk PRIMARY KEY (user_id, id, version);
ALTER TABLE tasks_cron DROP CONSTRAINT IF EXISTS tasks_cron_pkey;
ALTER TABLE tasks_cron ADD CONSTRAINT tasks_cron_pkey PRIMARY KEY (id, version);
ALTER TABLE tasks_heartbeat DROP CONSTRAINT IF EXISTS tasks_heartbeat_pkey;
ALTER TABLE tasks_heartbeat ADD CONSTRAINT tasks_heartbeat_pkey PRIMARY KEY (id, version);
ALTER TABLE tasks_webhook DROP CONSTRAINT IF EXISTS tasks_webhook_pkey;
ALTER TABLE tasks_webhook ADD CONSTRAINT tasks_webhook_pkey PRIMARY KEY (id, version);
ALTER TABLE signals_subscriptions DROP CONSTRAINT IF EXISTS signals_subscriptions_pkey;
ALTER TABLE signals_subscriptions ADD CONSTRAINT signals_subscriptions_pkey PRIMARY KEY (id, version);
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_pkey;
ALTER TABLE channels ADD CONSTRAINT channels_pkey PRIMARY KEY (id, version);
ALTER TABLE expose_endpoints DROP CONSTRAINT IF EXISTS expose_endpoints_pkey;
ALTER TABLE expose_endpoints ADD CONSTRAINT expose_endpoints_pkey PRIMARY KEY (id, version);
ALTER TABLE processes DROP CONSTRAINT IF EXISTS processes_pkey;
ALTER TABLE processes ADD CONSTRAINT processes_pkey PRIMARY KEY (id, version);
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_user_a_id_user_b_id_pk;
ALTER TABLE connections ADD CONSTRAINT connections_user_a_id_user_b_id_pk PRIMARY KEY (user_a_id, user_b_id, version);
ALTER TABLE system_prompts DROP CONSTRAINT IF EXISTS system_prompts_pkey;
ALTER TABLE system_prompts ADD CONSTRAINT system_prompts_pkey PRIMARY KEY (id, version);
--> statement-breakpoint
DROP INDEX IF EXISTS idx_users_nametag_required;
DROP INDEX IF EXISTS idx_users_nametag;
DROP INDEX IF EXISTS idx_users_single_owner;
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_name_unique;
DROP INDEX IF EXISTS signals_subscriptions_user_agent_pattern_unique;
CREATE UNIQUE INDEX idx_users_nametag ON users USING btree (nametag) WHERE valid_to IS NULL;
CREATE UNIQUE INDEX idx_users_single_owner ON users USING btree (is_owner) WHERE is_owner = 1 AND valid_to IS NULL;
CREATE UNIQUE INDEX channels_name_unique ON channels USING btree (name) WHERE valid_to IS NULL;
CREATE UNIQUE INDEX signals_subscriptions_user_agent_pattern_unique
    ON signals_subscriptions USING btree (user_id, agent_id, pattern) WHERE valid_to IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_users_id_valid_to ON users USING btree (id, valid_to);
CREATE INDEX IF NOT EXISTS idx_agents_id_valid_to ON agents USING btree (id, valid_to);
CREATE INDEX IF NOT EXISTS idx_tasks_id_valid_to ON tasks USING btree (id, valid_to);
CREATE INDEX IF NOT EXISTS idx_tasks_cron_id_valid_to ON tasks_cron USING btree (id, valid_to);
CREATE INDEX IF NOT EXISTS idx_tasks_heartbeat_id_valid_to ON tasks_heartbeat USING btree (id, valid_to);
CREATE INDEX IF NOT EXISTS idx_tasks_webhook_id_valid_to ON tasks_webhook USING btree (id, valid_to);
CREATE INDEX IF NOT EXISTS idx_signals_subscriptions_id_valid_to ON signals_subscriptions USING btree (id, valid_to);
CREATE INDEX IF NOT EXISTS idx_channels_id_valid_to ON channels USING btree (id, valid_to);
CREATE INDEX IF NOT EXISTS idx_expose_endpoints_id_valid_to ON expose_endpoints USING btree (id, valid_to);
CREATE INDEX IF NOT EXISTS idx_processes_id_valid_to ON processes USING btree (id, valid_to);
CREATE INDEX IF NOT EXISTS idx_connections_pair_valid_to ON connections USING btree (user_a_id, user_b_id, valid_to);
CREATE INDEX IF NOT EXISTS idx_system_prompts_id_valid_to ON system_prompts USING btree (id, valid_to);
