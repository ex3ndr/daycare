import type { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import {
    bigint,
    check,
    index,
    integer,
    pgTable,
    primaryKey,
    real,
    serial,
    text,
    uniqueIndex
} from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import type { Client as PostgresClient } from "pg";

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
        isOwner: integer("is_owner").notNull().default(0),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
        parentUserId: text("parent_user_id"),
        name: text("name"),
        firstName: text("first_name"),
        lastName: text("last_name"),
        country: text("country"),
        timezone: text("timezone"),
        nametag: text("nametag").notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.version] }),
        check("users_nametag_required", sql`trim(${table.nametag}) <> ''`),
        uniqueIndex("idx_users_nametag").on(table.nametag).where(sql`${table.validTo} IS NULL`),
        uniqueIndex("idx_users_single_owner")
            .on(table.isOwner)
            .where(sql`${table.isOwner} = 1 AND ${table.validTo} IS NULL`),
        index("idx_users_parent").on(table.parentUserId).where(sql`${table.parentUserId} IS NOT NULL`),
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
        type: text("type").notNull(),
        descriptor: text("descriptor").notNull(),
        activeSessionId: text("active_session_id"),
        permissions: text("permissions").notNull(),
        tokens: text("tokens"),
        stats: text("stats").notNull().default("{}"),
        lifecycle: text("lifecycle").notNull().default("active"),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
        userId: text("user_id").notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.version] }),
        index("idx_agents_user_id").on(table.userId),
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
        data: text("data").notNull()
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
        data: text("data").notNull()
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
        parameters: text("parameters"),
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

export const tasksCronTable = pgTable(
    "tasks_cron",
    {
        id: text("id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        taskId: text("task_id").notNull(),
        userId: text("user_id").notNull(),
        name: text("name").notNull(),
        description: text("description"),
        schedule: text("schedule").notNull(),
        timezone: text("timezone").notNull().default("UTC"),
        agentId: text("agent_id"),
        enabled: integer("enabled").notNull().default(1),
        deleteAfterRun: integer("delete_after_run").notNull().default(0),
        parameters: text("parameters"),
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

export const tasksHeartbeatTable = pgTable(
    "tasks_heartbeat",
    {
        id: text("id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        taskId: text("task_id").notNull(),
        userId: text("user_id").notNull(),
        title: text("title").notNull(),
        parameters: text("parameters"),
        lastRunAt: bigint("last_run_at", { mode: "number" }),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.version] }),
        index("idx_tasks_heartbeat_task_id").on(table.userId, table.taskId),
        index("idx_tasks_heartbeat_updated_at").on(table.updatedAt),
        index("idx_tasks_heartbeat_user_id").on(table.userId),
        index("idx_tasks_heartbeat_id_valid_to").on(table.id, table.validTo)
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
        source: text("source").notNull(),
        data: text("data"),
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
        silent: integer("silent").notNull().default(0),
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
        source: text("source").notNull(),
        data: text("data"),
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
        mentions: text("mentions").notNull(),
        createdAt: bigint("created_at", { mode: "number" }).notNull()
    },
    (table) => [index("idx_channel_messages_channel_created").on(table.channelId, table.createdAt)]
);

export const exposeEndpointsTable = pgTable(
    "expose_endpoints",
    {
        id: text("id").notNull(),
        version: integer("version").notNull().default(1),
        validFrom: bigint("valid_from", { mode: "number" }).notNull(),
        validTo: bigint("valid_to", { mode: "number" }),
        userId: text("user_id").notNull(),
        target: text("target").notNull(),
        provider: text("provider").notNull(),
        domain: text("domain").notNull(),
        mode: text("mode").notNull(),
        auth: text("auth"),
        createdAt: bigint("created_at", { mode: "number" }).notNull(),
        updatedAt: bigint("updated_at", { mode: "number" }).notNull()
    },
    (table) => [
        primaryKey({ columns: [table.id, table.version] }),
        index("idx_expose_endpoints_domain").on(table.domain),
        index("idx_expose_endpoints_user").on(table.userId),
        index("idx_expose_endpoints_id_valid_to").on(table.id, table.validTo)
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
        env: text("env").notNull(),
        packageManagers: text("package_managers").notNull(),
        allowedDomains: text("allowed_domains").notNull(),
        allowLocalBinding: integer("allow_local_binding").notNull().default(0),
        permissions: text("permissions").notNull(),
        owner: text("owner"),
        keepAlive: integer("keep_alive").notNull().default(0),
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
        requestedA: integer("requested_a").notNull().default(0),
        requestedB: integer("requested_b").notNull().default(0),
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
        enabled: integer("enabled").notNull().default(1),
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

export const observationLogTable = pgTable(
    "observation_log",
    {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull(),
        type: text("type").notNull(),
        source: text("source").notNull(),
        message: text("message").notNull(),
        details: text("details"),
        data: text("data"),
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

export const schema = {
    migrationsTable,
    usersTable,
    userConnectorKeysTable,
    agentsTable,
    sessionsTable,
    sessionHistoryTable,
    inboxTable,
    tasksTable,
    tasksCronTable,
    tasksHeartbeatTable,
    tasksWebhookTable,
    signalsEventsTable,
    signalsSubscriptionsTable,
    signalsDelayedTable,
    channelsTable,
    channelMembersTable,
    channelMessagesTable,
    exposeEndpointsTable,
    processesTable,
    connectionsTable,
    systemPromptsTable,
    tokenStatsHourlyTable,
    observationLogTable
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
