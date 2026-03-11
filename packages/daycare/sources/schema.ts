import type { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import {
    bigint,
    boolean,
    check,
    index,
    integer,
    jsonb,
    pgTable,
    primaryKey,
    real,
    serial,
    text,
    timestamp,
    uniqueIndex
} from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import type { Client as PostgresClient } from "pg";
import type { UserConfiguration } from "./engine/users/userConfigurationTypes.js";

export const migrationsTable = pgTable("_migrations", {
    name: text("name").primaryKey(),
    appliedAt: bigint("applied_at", { mode: "number" }).notNull()
});

export const usersTable = pgTable(
    "users",
    {
        id: text("id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        isWorkspace: boolean("is_workspace").notNull().default(false),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
        workspaceOwnerId: text("workspace_owner_id"),
        firstName: text("first_name"),
        lastName: text("last_name"),
        bio: text("bio"),
        about: text("about"),
        country: text("country"),
        timezone: text("timezone"),
        systemPrompt: text("system_prompt"),
        memory: boolean("memory").notNull().default(false),
        configuration: jsonb("configuration")
            .$type<UserConfiguration>()
            .notNull()
            .default(sql`'{"homeReady": false, "appReady": false, "bootstrapStarted": false}'::jsonb`),
        nametag: text("nametag").notNull(),
        emoji: text("emoji")
    },
    (table) => [
        primaryKey({ columns: [table.id, table.version] }),
        check("users_nametag_required", sql`trim(${table.nametag}) <> ''`),
        uniqueIndex("idx_users_nametag").on(table.nametag).where(sql`${table.validTo} IS NULL`),
        index("idx_users_workspace_owner").on(table.workspaceOwnerId).where(sql`${table.workspaceOwnerId} IS NOT NULL`),
        index("idx_users_id_valid_to").on(table.id, table.validTo)
    ]
);

export const userConnectorKeysTable = pgTable(
    "user_connector_keys",
    {
        id: serial("id").primaryKey(),
        userId: text("user_id").notNull(),
        connectorKey: text("connector_key").notNull().unique()
    },
    (table) => [index("idx_user_connector_keys_user_id").on(table.userId)]
);

export const agentsTable = pgTable(
    "agents",
    {
        id: text("id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        path: text("path").notNull(),
        kind: text("kind").notNull().default("agent"),
        modelRole: text("model_role"),
        connectorName: text("connector_name"),
        parentAgentId: text("parent_agent_id"),
        foreground: boolean("foreground").notNull().default(false),
        name: text("name"),
        description: text("description"),
        systemPrompt: text("system_prompt"),
        workspaceDir: text("workspace_dir"),
        nextSubIndex: integer("next_sub_index").notNull().default(0),
        activeSessionId: text("active_session_id"),
        permissions: jsonb("permissions").notNull(),
        lifecycle: text("lifecycle").notNull().default("active"),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
        userId: text("user_id").notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.version] }),
        index("idx_agents_user_id").on(table.userId),
        uniqueIndex("idx_agents_path_active").on(table.path).where(sql`${table.validTo} IS NULL`),
        index("idx_agents_parent_agent_id").on(table.parentAgentId).where(sql`${table.validTo} IS NULL`),
        index("idx_agents_id_valid_to").on(table.id, table.validTo)
    ]
);

export const sessionsTable = pgTable(
    "sessions",
    {
        id: text("id").primaryKey(),
        agentId: text("agent_id").notNull(),
        inferenceSessionId: text("inference_session_id"),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        resetMessage: text("reset_message"),
        invalidatedAt: bigint("invalidated_at", { mode: "number" }),
        processedUntil: bigint("processed_until", { mode: "number" }),
        endedAt: bigint("ended_at", { mode: "number" })
    },
    (table) => [
        index("idx_sessions_agent_id").on(table.agentId),
        index("idx_sessions_invalidated_at").on(table.invalidatedAt)
    ]
);

export const sessionHistoryTable = pgTable(
    "session_history",
    {
        id: serial("id").primaryKey(),
        sessionId: text("session_id")
            .notNull()
            .references(() => sessionsTable.id, { onDelete: "cascade" }),
        type: text("type").notNull(),
        at: bigint("at", { mode: "number" }).notNull(),
        data: jsonb("data").notNull()
    },
    (table) => [index("idx_session_history_session").on(table.sessionId)]
);

export const inboxTable = pgTable(
    "inbox",
    {
        id: text("id").primaryKey(),
        agentId: text("agent_id").notNull(),
        postedAt: bigint("posted_at", { mode: "number" }).notNull(),
        type: text("type").notNull(),
        data: jsonb("data").notNull()
    },
    (table) => [index("idx_inbox_agent_order").on(table.agentId, table.postedAt)]
);

export const tasksTable = pgTable(
    "tasks",
    {
        id: text("id").notNull(),
        userId: text("user_id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        title: text("title").notNull(),
        description: text("description"),
        code: text("code").notNull(),
        parameters: jsonb("parameters"),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.id, table.version] }),
        index("idx_tasks_user_id").on(table.userId),
        index("idx_tasks_updated_at").on(table.updatedAt),
        index("idx_tasks_id_valid_to").on(table.id, table.validTo)
    ]
);

export const todosTable = pgTable(
    "todos",
    {
        id: text("id").notNull(),
        workspaceId: text("workspace_id").notNull(),
        parentId: text("parent_id"),
        title: text("title").notNull(),
        description: text("description").notNull().default(""),
        status: text("status").notNull().default("unstarted"),
        rank: text("rank").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.workspaceId, table.id, table.version] }),
        check("todos_status_valid", sql`${table.status} IN ('draft', 'unstarted', 'started', 'finished', 'abandoned')`),
        index("idx_todos_workspace_parent_rank").on(table.workspaceId, table.parentId, table.rank),
        index("idx_todos_workspace_valid_to").on(table.workspaceId, table.validTo)
    ]
);

export const documentsTable = pgTable(
    "documents",
    {
        id: text("id").notNull(),
        userId: text("user_id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        slug: text("slug").notNull(),
        title: text("title").notNull(),
        description: text("description").notNull(),
        body: text("body").notNull().default(""),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.id, table.version] }),
        index("idx_documents_user_id").on(table.userId),
        index("idx_documents_updated_at").on(table.updatedAt),
        index("idx_documents_id_valid_to").on(table.id, table.validTo),
        index("idx_documents_slug_active").on(table.userId, table.slug).where(sql`${table.validTo} IS NULL`)
    ]
);

export const fragmentsTable = pgTable(
    "fragments",
    {
        id: text("id").notNull(),
        userId: text("user_id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        kitVersion: text("kit_version").notNull(),
        title: text("title").notNull(),
        description: text("description").notNull().default(""),
        spec: jsonb("spec").notNull(),
        archived: boolean("archived").notNull().default(false),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.id, table.version] }),
        index("idx_fragments_user_id").on(table.userId),
        index("idx_fragments_id_valid_to").on(table.id, table.validTo),
        index("idx_fragments_updated_at").on(table.updatedAt)
    ]
);

export const documentReferencesTable = pgTable(
    "document_references",
    {
        id: serial("id").primaryKey(),
        userId: text("user_id").notNull(),
        sourceId: text("source_id").notNull(),
        sourceVersion: integer("source_version").notNull(),
        targetId: text("target_id").notNull(),
        kind: text("kind").notNull()
    },
    (table) => [
        check("document_references_kind_valid", sql`${table.kind} IN ('parent', 'link', 'body')`),
        uniqueIndex("idx_doc_refs_unique").on(
            table.userId,
            table.sourceId,
            table.sourceVersion,
            table.targetId,
            table.kind
        ),
        index("idx_doc_refs_target").on(table.userId, table.targetId),
        index("idx_doc_refs_source").on(table.userId, table.sourceId, table.sourceVersion),
        index("idx_doc_refs_parent").on(table.userId, table.targetId).where(sql`${table.kind} = 'parent'`)
    ]
);

export const tasksCronTable = pgTable(
    "tasks_cron",
    {
        id: text("id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        taskId: text("task_id").notNull(),
        userId: text("user_id").notNull(),
        schedule: text("schedule").notNull(),
        timezone: text("timezone").notNull().default("UTC"),
        agentId: text("agent_id"),
        enabled: boolean("enabled").notNull().default(true),
        deleteAfterRun: boolean("delete_after_run").notNull().default(false),
        parameters: jsonb("parameters"),
        lastRunAt: bigint("last_run_at", { mode: "number" }),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.version] }),
        index("idx_tasks_cron_enabled").on(table.enabled),
        index("idx_tasks_cron_task_id").on(table.userId, table.taskId),
        index("idx_tasks_cron_updated_at").on(table.updatedAt),
        index("idx_tasks_cron_id_valid_to").on(table.id, table.validTo)
    ]
);

export const tasksWebhookTable = pgTable(
    "tasks_webhook",
    {
        id: text("id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        taskId: text("task_id").notNull(),
        userId: text("user_id").notNull(),
        agentId: text("agent_id"),
        lastRunAt: bigint("last_run_at", { mode: "number" }),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.version] }),
        index("idx_tasks_webhook_task_id").on(table.userId, table.taskId),
        index("idx_tasks_webhook_updated_at").on(table.updatedAt),
        index("idx_tasks_webhook_user_id").on(table.userId),
        index("idx_tasks_webhook_id_valid_to").on(table.id, table.validTo)
    ]
);

export const signalsEventsTable = pgTable(
    "signals_events",
    {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull(),
        type: text("type").notNull(),
        source: jsonb("source").notNull(),
        data: jsonb("data"),
        createdAt: bigint("created_at", { mode: "number" }).notNull()
    },
    (table) => [
        index("idx_signals_events_user").on(table.userId),
        index("idx_signals_events_type").on(table.type),
        index("idx_signals_events_created").on(table.createdAt)
    ]
);

export const signalsSubscriptionsTable = pgTable(
    "signals_subscriptions",
    {
        id: text("id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        userId: text("user_id").notNull(),
        agentId: text("agent_id").notNull(),
        pattern: text("pattern").notNull(),
        silent: boolean("silent").notNull().default(false),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.version] }),
        uniqueIndex("signals_subscriptions_user_agent_pattern_unique")
            .on(table.userId, table.agentId, table.pattern)
            .where(sql`${table.validTo} IS NULL`),
        index("idx_signals_subscriptions_user_agent").on(table.userId, table.agentId),
        index("idx_signals_subscriptions_id_valid_to").on(table.id, table.validTo)
    ]
);

export const signalsDelayedTable = pgTable(
    "signals_delayed",
    {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull(),
        type: text("type").notNull(),
        deliverAt: bigint("deliver_at", { mode: "number" }).notNull(),
        source: jsonb("source").notNull(),
        data: jsonb("data"),
        repeatKey: text("repeat_key"),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [index("idx_signals_delayed_deliver").on(table.deliverAt)]
);

export const channelsTable = pgTable(
    "channels",
    {
        id: text("id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        userId: text("user_id").notNull(),
        name: text("name").notNull(),
        leader: text("leader").notNull(),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.version] }),
        uniqueIndex("channels_name_unique").on(table.name).where(sql`${table.validTo} IS NULL`),
        index("idx_channels_name").on(table.name),
        index("idx_channels_user").on(table.userId),
        index("idx_channels_id_valid_to").on(table.id, table.validTo)
    ]
);

export const channelMembersTable = pgTable(
    "channel_members",
    {
        id: serial("id").primaryKey(),
        channelId: text("channel_id").notNull(),
        userId: text("user_id").notNull(),
        agentId: text("agent_id").notNull(),
        username: text("username").notNull(),
        joinedAt: bigint("joined_at", { mode: "number" }).notNull()
    },
    (table) => [
        uniqueIndex("channel_members_channel_agent_unique").on(table.channelId, table.agentId),
        index("idx_channel_members_channel").on(table.channelId)
    ]
);

export const channelMessagesTable = pgTable(
    "channel_messages",
    {
        id: text("id").primaryKey(),
        channelId: text("channel_id").notNull(),
        userId: text("user_id").notNull(),
        senderUsername: text("sender_username").notNull(),
        text: text("text").notNull(),
        mentions: jsonb("mentions").notNull(),
        createdAt: bigint("created_at", { mode: "number" }).notNull()
    },
    (table) => [index("idx_channel_messages_channel_created").on(table.channelId, table.createdAt)]
);

export const workspaceMembersTable = pgTable(
    "workspace_members",
    {
        id: serial("id").primaryKey(),
        workspaceId: text("workspace_id").notNull(),
        userId: text("user_id").notNull(),
        joinedAt: bigint("joined_at", { mode: "number" }).notNull(),
        leftAt: bigint("left_at", { mode: "number" }),
        kickReason: text("kick_reason")
    },
    (table) => [
        uniqueIndex("workspace_members_workspace_user_unique").on(table.workspaceId, table.userId),
        index("idx_workspace_members_workspace").on(table.workspaceId),
        index("idx_workspace_members_user").on(table.userId),
        index("idx_workspace_members_active_workspace")
            .on(table.workspaceId, table.joinedAt)
            .where(sql`${table.leftAt} IS NULL`),
        index("idx_workspace_members_active_user").on(table.userId, table.joinedAt).where(sql`${table.leftAt} IS NULL`)
    ]
);

export const processesTable = pgTable(
    "processes",
    {
        id: text("id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        userId: text("user_id").notNull(),
        name: text("name").notNull(),
        command: text("command").notNull(),
        cwd: text("cwd").notNull(),
        home: text("home"),
        env: jsonb("env").notNull(),
        packageManagers: jsonb("package_managers").notNull(),
        allowedDomains: jsonb("allowed_domains").notNull(),
        allowLocalBinding: boolean("allow_local_binding").notNull().default(false),
        permissions: jsonb("permissions").notNull(),
        owner: jsonb("owner"),
        keepAlive: boolean("keep_alive").notNull().default(false),
        desiredState: text("desired_state").notNull().default("running"),
        status: text("status").notNull().default("running"),
        pid: integer("pid"),
        bootTimeMs: bigint("boot_time_ms", { mode: "number" }),
        restartCount: integer("restart_count").notNull().default(0),
        restartFailureCount: integer("restart_failure_count").notNull().default(0),
        nextRestartAt: bigint("next_restart_at", { mode: "number" }),
        settingsPath: text("settings_path").notNull(),
        logPath: text("log_path").notNull(),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
        lastStartedAt: bigint("last_started_at", { mode: "number" }),
        lastExitedAt: bigint("last_exited_at", { mode: "number" })
    },
    (table) => [
        primaryKey({ columns: [table.id, table.version] }),
        index("idx_processes_owner").on(table.owner),
        index("idx_processes_user").on(table.userId),
        index("idx_processes_id_valid_to").on(table.id, table.validTo)
    ]
);

export const connectionsTable = pgTable(
    "connections",
    {
        userAId: text("user_a_id").notNull(),
        userBId: text("user_b_id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        requestedA: boolean("requested_a").notNull().default(false),
        requestedB: boolean("requested_b").notNull().default(false),
        requestedAAt: bigint("requested_a_at", { mode: "number" }),
        requestedBAt: bigint("requested_b_at", { mode: "number" })
    },
    (table) => [
        primaryKey({ columns: [table.userAId, table.userBId, table.version] }),
        check("connections_user_order", sql`${table.userAId} < ${table.userBId}`),
        index("idx_connections_user_b").on(table.userBId),
        index("idx_connections_pair_valid_to").on(table.userAId, table.userBId, table.validTo)
    ]
);

export const systemPromptsTable = pgTable(
    "system_prompts",
    {
        id: text("id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        scope: text("scope").notNull(),
        userId: text("user_id"),
        kind: text("kind").notNull(),
        condition: text("condition"),
        prompt: text("prompt").notNull(),
        enabled: boolean("enabled").notNull().default(true),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.version] }),
        index("idx_system_prompts_scope").on(table.scope),
        index("idx_system_prompts_user_id").on(table.userId),
        index("idx_system_prompts_id_valid_to").on(table.id, table.validTo)
    ]
);

export const tokenStatsHourlyTable = pgTable(
    "token_stats_hourly",
    {
        hourStart: bigint("hour_start", { mode: "number" }).notNull(),
        userId: text("user_id").notNull(),
        agentId: text("agent_id").notNull(),
        model: text("model").notNull(),
        inputTokens: integer("input_tokens").notNull().default(0),
        outputTokens: integer("output_tokens").notNull().default(0),
        cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
        cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
        cost: real("cost").notNull().default(0)
    },
    (table) => [
        primaryKey({ columns: [table.hourStart, table.userId, table.agentId, table.model] }),
        index("idx_token_stats_hourly_hour_start").on(table.hourStart),
        index("idx_token_stats_hourly_user_hour").on(table.userId, table.hourStart),
        index("idx_token_stats_hourly_agent_hour").on(table.agentId, table.hourStart)
    ]
);

export const keyValuesTable = pgTable(
    "key_values",
    {
        userId: text("user_id").notNull(),
        key: text("key").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        value: jsonb("value"),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.key, table.version] }),
        uniqueIndex("idx_key_values_user_key_active").on(table.userId, table.key).where(sql`${table.validTo} IS NULL`),
        index("idx_key_values_user").on(table.userId),
        index("idx_key_values_user_key_valid_to").on(table.userId, table.key, table.validTo),
        index("idx_key_values_user_updated").on(table.userId, table.updatedAt)
    ]
);

export const psqlDatabasesTable = pgTable(
    "psql_databases",
    {
        userId: text("user_id").notNull(),
        id: text("id").notNull(),
        name: text("name").notNull(),
        createdAt: bigint("created_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.id] }),
        index("idx_psql_databases_user_created").on(table.userId, table.createdAt),
        index("idx_psql_databases_user_name").on(table.userId, table.name)
    ]
);

export const miniAppsTable = pgTable(
    "mini_apps",
    {
        userId: text("user_id").notNull(),
        id: text("id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        title: text("title").notNull(),
        icon: text("icon").notNull(),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.id, table.version] }),
        index("idx_mini_apps_user_id").on(table.userId),
        index("idx_mini_apps_updated_at").on(table.updatedAt),
        uniqueIndex("idx_mini_apps_user_id_active").on(table.userId, table.id).where(sql`${table.validTo} IS NULL`),
        index("idx_mini_apps_id_valid_to").on(table.id, table.validTo)
    ]
);

export const observationLogTable = pgTable(
    "observation_log",
    {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull(),
        type: text("type").notNull(),
        source: text("source").notNull(),
        message: text("message").notNull(),
        details: text("details"),
        data: jsonb("data"),
        scopeIds: text("scope_ids").array().notNull().default([]),
        createdAt: bigint("created_at", { mode: "number" }).notNull()
    },
    (table) => [
        index("idx_observation_log_user").on(table.userId),
        index("idx_observation_log_type").on(table.type),
        index("idx_observation_log_created").on(table.createdAt),
        index("idx_observation_log_user_created").on(table.userId, table.createdAt),
        // Actual index is GIN (created via migration SQL); declared here for schema matcher
        index("idx_observation_log_scopes").on(table.scopeIds)
    ]
);

export const modelRoleRulesTable = pgTable(
    "model_role_rules",
    {
        id: text("id").primaryKey(),
        role: text("role"),
        kind: text("kind"),
        userId: text("user_id"),
        agentId: text("agent_id"),
        model: text("model").notNull(),
        reasoning: text("reasoning"),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        index("idx_model_role_rules_role").on(table.role),
        index("idx_model_role_rules_kind").on(table.kind),
        index("idx_model_role_rules_user_id").on(table.userId),
        index("idx_model_role_rules_agent_id").on(table.agentId)
    ]
);

export const appAuthUsersTable = pgTable(
    "app_auth_users",
    {
        id: text("id").primaryKey(),
        email: text("email").notNull(),
        emailVerified: boolean("email_verified").notNull().default(false),
        name: text("name").notNull(),
        image: text("image"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull()
    },
    (table) => [
        uniqueIndex("idx_app_auth_users_email").on(table.email),
        index("idx_app_auth_users_created_at").on(table.createdAt)
    ]
);

export const appAuthSessionsTable = pgTable(
    "app_auth_sessions",
    {
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => appAuthUsersTable.id, { onDelete: "cascade" }),
        token: text("token").notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull()
    },
    (table) => [
        uniqueIndex("idx_app_auth_sessions_token").on(table.token),
        index("idx_app_auth_sessions_user_id").on(table.userId),
        index("idx_app_auth_sessions_expires_at").on(table.expiresAt)
    ]
);

export const appAuthAccountsTable = pgTable(
    "app_auth_accounts",
    {
        id: text("id").primaryKey(),
        providerId: text("provider_id").notNull(),
        accountId: text("account_id").notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => appAuthUsersTable.id, { onDelete: "cascade" }),
        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),
        accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: "date" }),
        refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" }),
        scope: text("scope"),
        password: text("password"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull()
    },
    (table) => [
        uniqueIndex("idx_app_auth_accounts_provider_account").on(table.providerId, table.accountId),
        index("idx_app_auth_accounts_user_id").on(table.userId)
    ]
);

export const appAuthVerificationsTable = pgTable(
    "app_auth_verifications",
    {
        id: text("id").primaryKey(),
        identifier: text("identifier").notNull(),
        value: text("value").notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull()
    },
    (table) => [
        uniqueIndex("idx_app_auth_verifications_identifier").on(table.identifier),
        index("idx_app_auth_verifications_expires_at").on(table.expiresAt)
    ]
);

export const schema = {
    migrationsTable,
    usersTable,
    userConnectorKeysTable,
    agentsTable,
    sessionsTable,
    sessionHistoryTable,
    inboxTable,
    tasksTable,
    todosTable,
    documentsTable,
    fragmentsTable,
    documentReferencesTable,
    tasksCronTable,
    tasksWebhookTable,
    signalsEventsTable,
    signalsSubscriptionsTable,
    signalsDelayedTable,
    channelsTable,
    channelMembersTable,
    channelMessagesTable,
    workspaceMembersTable,
    processesTable,
    connectionsTable,
    systemPromptsTable,
    tokenStatsHourlyTable,
    keyValuesTable,
    observationLogTable,
    psqlDatabasesTable,
    miniAppsTable,
    modelRoleRulesTable,
    appAuthUsersTable,
    appAuthSessionsTable,
    appAuthAccountsTable,
    appAuthVerificationsTable
};

/**
 * Unified Drizzle database type used by all repositories.
 * Both PGlite and node-postgres adapters are structurally compatible
 * at runtime; we use PgliteDatabase as the canonical type.
 */
export type DaycareDb = PgliteDatabase<typeof schema>;

export function schemaDrizzle(client: PGlite | PostgresClient): DaycareDb {
    // PGlite instances have a `waitReady` property; pg Client does not.
    if ("waitReady" in client) {
        return drizzlePglite(client as PGlite, { schema });
    }
    return drizzleNodePg(client as PostgresClient, { schema }) as unknown as DaycareDb;
}
