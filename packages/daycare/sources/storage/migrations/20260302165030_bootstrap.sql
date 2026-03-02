CREATE TABLE IF NOT EXISTS "_migrations" (
    "name" text PRIMARY KEY NOT NULL,
    "applied_at" bigint NOT NULL
);

CREATE TABLE "users" (
    "id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "is_owner" boolean DEFAULT false NOT NULL,
    "is_swarm" boolean DEFAULT false NOT NULL,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    "parent_user_id" text,
    "first_name" text,
    "last_name" text,
    "bio" text,
    "about" text,
    "country" text,
    "timezone" text,
    "system_prompt" text,
    "memory" boolean DEFAULT false NOT NULL,
    "nametag" text NOT NULL,
    CONSTRAINT "users_id_version_pk" PRIMARY KEY("id", "version"),
    CONSTRAINT "users_nametag_required" CHECK (trim("users"."nametag") <> '')
);

CREATE TABLE "user_connector_keys" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "connector_key" text NOT NULL,
    CONSTRAINT "user_connector_keys_connector_key_unique" UNIQUE("connector_key")
);

CREATE TABLE "agents" (
    "id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "path" text NOT NULL,
    "kind" text DEFAULT 'agent' NOT NULL,
    "model_role" text,
    "connector_name" text,
    "parent_agent_id" text,
    "foreground" boolean DEFAULT false NOT NULL,
    "name" text,
    "description" text,
    "system_prompt" text,
    "workspace_dir" text,
    "next_sub_index" integer DEFAULT 0 NOT NULL,
    "active_session_id" text,
    "permissions" jsonb NOT NULL,
    "tokens" jsonb,
    "lifecycle" text DEFAULT 'active' NOT NULL,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    "user_id" text NOT NULL,
    CONSTRAINT "agents_id_version_pk" PRIMARY KEY("id", "version")
);

CREATE TABLE "sessions" (
    "id" text PRIMARY KEY NOT NULL,
    "agent_id" text NOT NULL,
    "inference_session_id" text,
    "created_at" bigint NOT NULL,
    "reset_message" text,
    "invalidated_at" bigint,
    "processed_until" bigint,
    "ended_at" bigint
);

CREATE TABLE "session_history" (
    "id" serial PRIMARY KEY NOT NULL,
    "session_id" text NOT NULL,
    "type" text NOT NULL,
    "at" bigint NOT NULL,
    "data" jsonb NOT NULL,
    CONSTRAINT "session_history_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "inbox" (
    "id" text PRIMARY KEY NOT NULL,
    "agent_id" text NOT NULL,
    "posted_at" bigint NOT NULL,
    "type" text NOT NULL,
    "data" jsonb NOT NULL
);

CREATE TABLE "tasks" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "title" text NOT NULL,
    "description" text,
    "code" text NOT NULL,
    "parameters" jsonb,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "tasks_user_id_id_version_pk" PRIMARY KEY("user_id", "id", "version")
);

CREATE TABLE "documents" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "slug" text NOT NULL,
    "title" text NOT NULL,
    "description" text NOT NULL,
    "body" text DEFAULT '' NOT NULL,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "documents_user_id_id_version_pk" PRIMARY KEY("user_id", "id", "version")
);

CREATE TABLE "document_references" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "source_id" text NOT NULL,
    "source_version" integer NOT NULL,
    "target_id" text NOT NULL,
    "kind" text NOT NULL,
    CONSTRAINT "document_references_kind_valid" CHECK ("document_references"."kind" IN ('parent', 'link', 'body'))
);

CREATE TABLE "tasks_cron" (
    "id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "task_id" text NOT NULL,
    "user_id" text NOT NULL,
    "schedule" text NOT NULL,
    "timezone" text DEFAULT 'UTC' NOT NULL,
    "agent_id" text,
    "enabled" boolean DEFAULT true NOT NULL,
    "delete_after_run" boolean DEFAULT false NOT NULL,
    "parameters" jsonb,
    "last_run_at" bigint,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "tasks_cron_id_version_pk" PRIMARY KEY("id", "version")
);

CREATE TABLE "tasks_webhook" (
    "id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "task_id" text NOT NULL,
    "user_id" text NOT NULL,
    "agent_id" text,
    "last_run_at" bigint,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "tasks_webhook_id_version_pk" PRIMARY KEY("id", "version")
);

CREATE TABLE "signals_events" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "type" text NOT NULL,
    "source" jsonb NOT NULL,
    "data" jsonb,
    "created_at" bigint NOT NULL
);

CREATE TABLE "signals_subscriptions" (
    "id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "user_id" text NOT NULL,
    "agent_id" text NOT NULL,
    "pattern" text NOT NULL,
    "silent" boolean DEFAULT false NOT NULL,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "signals_subscriptions_id_version_pk" PRIMARY KEY("id", "version")
);

CREATE TABLE "signals_delayed" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "type" text NOT NULL,
    "deliver_at" bigint NOT NULL,
    "source" jsonb NOT NULL,
    "data" jsonb,
    "repeat_key" text,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL
);

CREATE TABLE "channels" (
    "id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "user_id" text NOT NULL,
    "name" text NOT NULL,
    "leader" text NOT NULL,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "channels_id_version_pk" PRIMARY KEY("id", "version")
);

CREATE TABLE "channel_members" (
    "id" serial PRIMARY KEY NOT NULL,
    "channel_id" text NOT NULL,
    "user_id" text NOT NULL,
    "agent_id" text NOT NULL,
    "username" text NOT NULL,
    "joined_at" bigint NOT NULL
);

CREATE TABLE "channel_messages" (
    "id" text PRIMARY KEY NOT NULL,
    "channel_id" text NOT NULL,
    "user_id" text NOT NULL,
    "sender_username" text NOT NULL,
    "text" text NOT NULL,
    "mentions" jsonb NOT NULL,
    "created_at" bigint NOT NULL
);

CREATE TABLE "expose_endpoints" (
    "id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "user_id" text NOT NULL,
    "target" jsonb NOT NULL,
    "provider" text NOT NULL,
    "domain" text NOT NULL,
    "mode" text NOT NULL,
    "auth" jsonb,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "expose_endpoints_id_version_pk" PRIMARY KEY("id", "version")
);

CREATE TABLE "processes" (
    "id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "user_id" text NOT NULL,
    "name" text NOT NULL,
    "command" text NOT NULL,
    "cwd" text NOT NULL,
    "home" text,
    "env" jsonb NOT NULL,
    "package_managers" jsonb NOT NULL,
    "allowed_domains" jsonb NOT NULL,
    "allow_local_binding" boolean DEFAULT false NOT NULL,
    "permissions" jsonb NOT NULL,
    "owner" jsonb,
    "keep_alive" boolean DEFAULT false NOT NULL,
    "desired_state" text DEFAULT 'running' NOT NULL,
    "status" text DEFAULT 'running' NOT NULL,
    "pid" integer,
    "boot_time_ms" bigint,
    "restart_count" integer DEFAULT 0 NOT NULL,
    "restart_failure_count" integer DEFAULT 0 NOT NULL,
    "next_restart_at" bigint,
    "settings_path" text NOT NULL,
    "log_path" text NOT NULL,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    "last_started_at" bigint,
    "last_exited_at" bigint,
    CONSTRAINT "processes_id_version_pk" PRIMARY KEY("id", "version")
);

CREATE TABLE "connections" (
    "user_a_id" text NOT NULL,
    "user_b_id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "requested_a" boolean DEFAULT false NOT NULL,
    "requested_b" boolean DEFAULT false NOT NULL,
    "requested_a_at" bigint,
    "requested_b_at" bigint,
    CONSTRAINT "connections_user_a_id_user_b_id_version_pk" PRIMARY KEY("user_a_id", "user_b_id", "version"),
    CONSTRAINT "connections_user_order" CHECK ("connections"."user_a_id" < "connections"."user_b_id")
);

CREATE TABLE "system_prompts" (
    "id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "scope" text NOT NULL,
    "user_id" text,
    "kind" text NOT NULL,
    "condition" text,
    "prompt" text NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "system_prompts_id_version_pk" PRIMARY KEY("id", "version")
);

CREATE TABLE "swarm_contacts" (
    "swarm_user_id" text NOT NULL,
    "contact_agent_id" text NOT NULL,
    "swarm_agent_id" text NOT NULL,
    "messages_sent" integer DEFAULT 0 NOT NULL,
    "messages_received" integer DEFAULT 0 NOT NULL,
    "first_contact_at" bigint NOT NULL,
    "last_contact_at" bigint NOT NULL,
    CONSTRAINT "swarm_contacts_swarm_user_id_contact_agent_id_pk" PRIMARY KEY("swarm_user_id", "contact_agent_id")
);

CREATE TABLE "token_stats_hourly" (
    "hour_start" bigint NOT NULL,
    "user_id" text NOT NULL,
    "agent_id" text NOT NULL,
    "model" text NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "cache_read_tokens" integer DEFAULT 0 NOT NULL,
    "cache_write_tokens" integer DEFAULT 0 NOT NULL,
    "cost" real DEFAULT 0 NOT NULL,
    CONSTRAINT "token_stats_hourly_hour_start_user_id_agent_id_model_pk" PRIMARY KEY("hour_start", "user_id", "agent_id", "model")
);

CREATE TABLE "observation_log" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "type" text NOT NULL,
    "source" text NOT NULL,
    "message" text NOT NULL,
    "details" text,
    "data" jsonb,
    "scope_ids" text[] DEFAULT '{}' NOT NULL,
    "created_at" bigint NOT NULL
);

CREATE UNIQUE INDEX "idx_users_nametag" ON "users" USING btree ("nametag") WHERE "users"."valid_to" IS NULL;
CREATE UNIQUE INDEX "idx_users_single_owner" ON "users" USING btree ("is_owner") WHERE "users"."is_owner" = true AND "users"."valid_to" IS NULL;
CREATE INDEX "idx_users_parent" ON "users" USING btree ("parent_user_id") WHERE "users"."parent_user_id" IS NOT NULL;
CREATE INDEX "idx_users_id_valid_to" ON "users" USING btree ("id", "valid_to");

CREATE INDEX "idx_user_connector_keys_user_id" ON "user_connector_keys" USING btree ("user_id");

CREATE INDEX "idx_agents_user_id" ON "agents" USING btree ("user_id");
CREATE UNIQUE INDEX "idx_agents_path_active" ON "agents" USING btree ("path") WHERE "agents"."valid_to" IS NULL;
CREATE INDEX "idx_agents_parent_agent_id" ON "agents" USING btree ("parent_agent_id") WHERE "agents"."valid_to" IS NULL;
CREATE INDEX "idx_agents_id_valid_to" ON "agents" USING btree ("id", "valid_to");

CREATE INDEX "idx_sessions_agent_id" ON "sessions" USING btree ("agent_id");
CREATE INDEX "idx_sessions_invalidated_at" ON "sessions" USING btree ("invalidated_at");

CREATE INDEX "idx_session_history_session" ON "session_history" USING btree ("session_id");

CREATE INDEX "idx_inbox_agent_order" ON "inbox" USING btree ("agent_id", "posted_at");

CREATE INDEX "idx_tasks_user_id" ON "tasks" USING btree ("user_id");
CREATE INDEX "idx_tasks_updated_at" ON "tasks" USING btree ("updated_at");
CREATE INDEX "idx_tasks_id_valid_to" ON "tasks" USING btree ("id", "valid_to");

CREATE INDEX "idx_documents_user_id" ON "documents" USING btree ("user_id");
CREATE INDEX "idx_documents_updated_at" ON "documents" USING btree ("updated_at");
CREATE INDEX "idx_documents_id_valid_to" ON "documents" USING btree ("id", "valid_to");
CREATE INDEX "idx_documents_slug_active" ON "documents" USING btree ("user_id", "slug") WHERE "documents"."valid_to" IS NULL;

CREATE UNIQUE INDEX "idx_doc_refs_unique" ON "document_references" USING btree ("user_id", "source_id", "source_version", "target_id", "kind");
CREATE INDEX "idx_doc_refs_target" ON "document_references" USING btree ("user_id", "target_id");
CREATE INDEX "idx_doc_refs_source" ON "document_references" USING btree ("user_id", "source_id", "source_version");
CREATE INDEX "idx_doc_refs_parent" ON "document_references" USING btree ("user_id", "target_id") WHERE "document_references"."kind" = 'parent';

CREATE INDEX "idx_tasks_cron_enabled" ON "tasks_cron" USING btree ("enabled");
CREATE INDEX "idx_tasks_cron_task_id" ON "tasks_cron" USING btree ("user_id", "task_id");
CREATE INDEX "idx_tasks_cron_updated_at" ON "tasks_cron" USING btree ("updated_at");
CREATE INDEX "idx_tasks_cron_id_valid_to" ON "tasks_cron" USING btree ("id", "valid_to");

CREATE INDEX "idx_tasks_webhook_task_id" ON "tasks_webhook" USING btree ("user_id", "task_id");
CREATE INDEX "idx_tasks_webhook_updated_at" ON "tasks_webhook" USING btree ("updated_at");
CREATE INDEX "idx_tasks_webhook_user_id" ON "tasks_webhook" USING btree ("user_id");
CREATE INDEX "idx_tasks_webhook_id_valid_to" ON "tasks_webhook" USING btree ("id", "valid_to");

CREATE INDEX "idx_signals_events_user" ON "signals_events" USING btree ("user_id");
CREATE INDEX "idx_signals_events_type" ON "signals_events" USING btree ("type");
CREATE INDEX "idx_signals_events_created" ON "signals_events" USING btree ("created_at");

CREATE UNIQUE INDEX "signals_subscriptions_user_agent_pattern_unique" ON "signals_subscriptions" USING btree ("user_id", "agent_id", "pattern") WHERE "signals_subscriptions"."valid_to" IS NULL;
CREATE INDEX "idx_signals_subscriptions_user_agent" ON "signals_subscriptions" USING btree ("user_id", "agent_id");
CREATE INDEX "idx_signals_subscriptions_id_valid_to" ON "signals_subscriptions" USING btree ("id", "valid_to");

CREATE INDEX "idx_signals_delayed_deliver" ON "signals_delayed" USING btree ("deliver_at");

CREATE UNIQUE INDEX "channels_name_unique" ON "channels" USING btree ("name") WHERE "channels"."valid_to" IS NULL;
CREATE INDEX "idx_channels_name" ON "channels" USING btree ("name");
CREATE INDEX "idx_channels_user" ON "channels" USING btree ("user_id");
CREATE INDEX "idx_channels_id_valid_to" ON "channels" USING btree ("id", "valid_to");

CREATE UNIQUE INDEX "channel_members_channel_agent_unique" ON "channel_members" USING btree ("channel_id", "agent_id");
CREATE INDEX "idx_channel_members_channel" ON "channel_members" USING btree ("channel_id");

CREATE INDEX "idx_channel_messages_channel_created" ON "channel_messages" USING btree ("channel_id", "created_at");

CREATE INDEX "idx_expose_endpoints_domain" ON "expose_endpoints" USING btree ("domain");
CREATE INDEX "idx_expose_endpoints_user" ON "expose_endpoints" USING btree ("user_id");
CREATE INDEX "idx_expose_endpoints_id_valid_to" ON "expose_endpoints" USING btree ("id", "valid_to");

CREATE INDEX "idx_processes_owner" ON "processes" USING btree ("owner");
CREATE INDEX "idx_processes_user" ON "processes" USING btree ("user_id");
CREATE INDEX "idx_processes_id_valid_to" ON "processes" USING btree ("id", "valid_to");

CREATE INDEX "idx_connections_user_b" ON "connections" USING btree ("user_b_id");
CREATE INDEX "idx_connections_pair_valid_to" ON "connections" USING btree ("user_a_id", "user_b_id", "valid_to");

CREATE INDEX "idx_system_prompts_scope" ON "system_prompts" USING btree ("scope");
CREATE INDEX "idx_system_prompts_user_id" ON "system_prompts" USING btree ("user_id");
CREATE INDEX "idx_system_prompts_id_valid_to" ON "system_prompts" USING btree ("id", "valid_to");

CREATE INDEX "idx_swarm_contacts_swarm_user_id" ON "swarm_contacts" USING btree ("swarm_user_id");
CREATE INDEX "idx_swarm_contacts_swarm_agent_id" ON "swarm_contacts" USING btree ("swarm_agent_id");

CREATE INDEX "idx_token_stats_hourly_hour_start" ON "token_stats_hourly" USING btree ("hour_start");
CREATE INDEX "idx_token_stats_hourly_user_hour" ON "token_stats_hourly" USING btree ("user_id", "hour_start");
CREATE INDEX "idx_token_stats_hourly_agent_hour" ON "token_stats_hourly" USING btree ("agent_id", "hour_start");

CREATE INDEX "idx_observation_log_user" ON "observation_log" USING btree ("user_id");
CREATE INDEX "idx_observation_log_type" ON "observation_log" USING btree ("type");
CREATE INDEX "idx_observation_log_created" ON "observation_log" USING btree ("created_at");
CREATE INDEX "idx_observation_log_user_created" ON "observation_log" USING btree ("user_id", "created_at");
CREATE INDEX "idx_observation_log_scopes" ON "observation_log" USING GIN ("scope_ids");
