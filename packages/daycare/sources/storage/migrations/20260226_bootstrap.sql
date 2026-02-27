CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"descriptor" text NOT NULL,
	"active_session_id" text,
	"permissions" text NOT NULL,
	"tokens" text,
	"stats" text DEFAULT '{}' NOT NULL,
	"lifecycle" text DEFAULT 'active' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"username" text NOT NULL,
	"joined_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"sender_username" text NOT NULL,
	"text" text NOT NULL,
	"mentions" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"leader" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "channels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"user_a_id" text NOT NULL,
	"user_b_id" text NOT NULL,
	"requested_a" integer DEFAULT 0 NOT NULL,
	"requested_b" integer DEFAULT 0 NOT NULL,
	"requested_a_at" bigint,
	"requested_b_at" bigint,
	CONSTRAINT "connections_user_a_id_user_b_id_pk" PRIMARY KEY("user_a_id","user_b_id"),
	CONSTRAINT "connections_user_order" CHECK ("connections"."user_a_id" < "connections"."user_b_id")
);
--> statement-breakpoint
CREATE TABLE "expose_endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target" text NOT NULL,
	"provider" text NOT NULL,
	"domain" text NOT NULL,
	"mode" text NOT NULL,
	"auth" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"posted_at" bigint NOT NULL,
	"type" text NOT NULL,
	"data" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_migrations" (
	"name" text PRIMARY KEY NOT NULL,
	"applied_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"command" text NOT NULL,
	"cwd" text NOT NULL,
	"home" text,
	"env" text NOT NULL,
	"package_managers" text NOT NULL,
	"allowed_domains" text NOT NULL,
	"allow_local_binding" integer DEFAULT 0 NOT NULL,
	"permissions" text NOT NULL,
	"owner" text,
	"keep_alive" integer DEFAULT 0 NOT NULL,
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
	"last_exited_at" bigint
);
--> statement-breakpoint
CREATE TABLE "session_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"type" text NOT NULL,
	"at" bigint NOT NULL,
	"data" text NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "signals_delayed" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"deliver_at" bigint NOT NULL,
	"source" text NOT NULL,
	"data" text,
	"repeat_key" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"data" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"pattern" text NOT NULL,
	"silent" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_prompts" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"condition" text,
	"prompt" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks_cron" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"schedule" text NOT NULL,
	"agent_id" text,
	"enabled" integer DEFAULT 1 NOT NULL,
	"delete_after_run" integer DEFAULT 0 NOT NULL,
	"last_run_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks_heartbeat" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"last_run_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"code" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "tasks_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
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
	CONSTRAINT "token_stats_hourly_hour_start_user_id_agent_id_model_pk" PRIMARY KEY("hour_start","user_id","agent_id","model")
);
--> statement-breakpoint
CREATE TABLE "user_connector_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connector_key" text NOT NULL,
	CONSTRAINT "user_connector_keys_connector_key_unique" UNIQUE("connector_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"is_owner" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"parent_user_id" text,
	"name" text,
	"nametag" text NOT NULL,
	CONSTRAINT "users_nametag_required" CHECK (trim("users"."nametag") <> '')
);
--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_history" ADD CONSTRAINT "session_history_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks_cron" ADD CONSTRAINT "tasks_cron_user_id_task_id_tasks_user_id_id_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks_heartbeat" ADD CONSTRAINT "tasks_heartbeat_user_id_task_id_tasks_user_id_id_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_stats_hourly" ADD CONSTRAINT "token_stats_hourly_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_stats_hourly" ADD CONSTRAINT "token_stats_hourly_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_connector_keys" ADD CONSTRAINT "user_connector_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_parent_user_id_users_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agents_user_id" ON "agents" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_members_channel_agent_unique" ON "channel_members" USING btree ("channel_id","agent_id");--> statement-breakpoint
CREATE INDEX "idx_channel_members_channel" ON "channel_members" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_channel_messages_channel_created" ON "channel_messages" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_channels_name" ON "channels" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_channels_user" ON "channels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_connections_user_b" ON "connections" USING btree ("user_b_id");--> statement-breakpoint
CREATE INDEX "idx_expose_endpoints_domain" ON "expose_endpoints" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_expose_endpoints_user" ON "expose_endpoints" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_inbox_agent_order" ON "inbox" USING btree ("agent_id","posted_at");--> statement-breakpoint
CREATE INDEX "idx_processes_owner" ON "processes" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "idx_processes_user" ON "processes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_session_history_session" ON "session_history" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_agent_id" ON "sessions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_invalidated_at" ON "sessions" USING btree ("invalidated_at");--> statement-breakpoint
CREATE INDEX "idx_signals_delayed_deliver" ON "signals_delayed" USING btree ("deliver_at");--> statement-breakpoint
CREATE INDEX "idx_signals_events_user" ON "signals_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_signals_events_type" ON "signals_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_signals_events_created" ON "signals_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "signals_subscriptions_user_agent_pattern_unique" ON "signals_subscriptions" USING btree ("user_id","agent_id","pattern");--> statement-breakpoint
CREATE INDEX "idx_signals_subscriptions_user_agent" ON "signals_subscriptions" USING btree ("user_id","agent_id");--> statement-breakpoint
CREATE INDEX "idx_system_prompts_scope" ON "system_prompts" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "idx_system_prompts_user_id" ON "system_prompts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_cron_enabled" ON "tasks_cron" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_tasks_cron_task_id" ON "tasks_cron" USING btree ("user_id","task_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_cron_updated_at" ON "tasks_cron" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_heartbeat_task_id" ON "tasks_heartbeat" USING btree ("user_id","task_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_heartbeat_updated_at" ON "tasks_heartbeat" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_heartbeat_user_id" ON "tasks_heartbeat" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_user_id" ON "tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_updated_at" ON "tasks" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_token_stats_hourly_hour_start" ON "token_stats_hourly" USING btree ("hour_start");--> statement-breakpoint
CREATE INDEX "idx_token_stats_hourly_user_hour" ON "token_stats_hourly" USING btree ("user_id","hour_start");--> statement-breakpoint
CREATE INDEX "idx_token_stats_hourly_agent_hour" ON "token_stats_hourly" USING btree ("agent_id","hour_start");--> statement-breakpoint
CREATE INDEX "idx_user_connector_keys_user_id" ON "user_connector_keys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_nametag_required" ON "users" USING btree ("nametag");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_nametag" ON "users" USING btree ("nametag");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_single_owner" ON "users" USING btree ("is_owner") WHERE "users"."is_owner" = 1;--> statement-breakpoint
CREATE INDEX "idx_users_parent" ON "users" USING btree ("parent_user_id") WHERE "users"."parent_user_id" IS NOT NULL;

INSERT INTO users (id, is_owner, created_at, updated_at, parent_user_id, name, nametag)
SELECT 'sy45wijd1hmr03ef2wu7busv', 1, 0, 0, NULL, 'Owner', 'owner'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE is_owner = 1);
