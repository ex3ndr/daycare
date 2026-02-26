import type Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import {
    check,
    foreignKey,
    index,
    integer,
    primaryKey,
    real,
    sqliteTable,
    text,
    uniqueIndex
} from "drizzle-orm/sqlite-core";

export const migrationsTable = sqliteTable("_migrations", {
    name: text("name").primaryKey(),
    appliedAt: integer("applied_at").notNull()
});

export const usersTable = sqliteTable(
    "users",
    {
        id: text("id").primaryKey(),
        isOwner: integer("is_owner", { mode: "boolean" }).notNull().default(false),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull(),
        parentUserId: text("parent_user_id"),
        name: text("name"),
        nametag: text("nametag").notNull()
    },
    (table) => [
        check("users_nametag_required", sql`trim(${table.nametag}) <> ''`),
        foreignKey({
            columns: [table.parentUserId],
            foreignColumns: [table.id]
        }),
        uniqueIndex("idx_users_nametag_required").on(table.nametag),
        uniqueIndex("idx_users_nametag").on(table.nametag),
        uniqueIndex("idx_users_single_owner").on(table.isOwner).where(sql`${table.isOwner} = 1`),
        index("idx_users_parent").on(table.parentUserId).where(sql`${table.parentUserId} IS NOT NULL`)
    ]
);

export const userConnectorKeysTable = sqliteTable(
    "user_connector_keys",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        userId: text("user_id")
            .notNull()
            .references(() => usersTable.id, { onDelete: "cascade" }),
        connectorKey: text("connector_key").notNull().unique()
    },
    (table) => [index("idx_user_connector_keys_user_id").on(table.userId)]
);

export const agentsTable = sqliteTable(
    "agents",
    {
        id: text("id").primaryKey(),
        type: text("type").notNull(),
        descriptor: text("descriptor").notNull(),
        activeSessionId: text("active_session_id"),
        permissions: text("permissions").notNull(),
        tokens: text("tokens"),
        stats: text("stats").notNull().default("{}"),
        lifecycle: text("lifecycle").notNull().default("active"),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull(),
        userId: text("user_id").notNull()
    },
    (table) => [index("idx_agents_user_id").on(table.userId)]
);

export const sessionsTable = sqliteTable(
    "sessions",
    {
        id: text("id").primaryKey(),
        agentId: text("agent_id")
            .notNull()
            .references(() => agentsTable.id, { onDelete: "cascade" }),
        inferenceSessionId: text("inference_session_id"),
        createdAt: integer("created_at").notNull(),
        resetMessage: text("reset_message"),
        invalidatedAt: integer("invalidated_at"),
        processedUntil: integer("processed_until"),
        endedAt: integer("ended_at")
    },
    (table) => [
        index("idx_sessions_agent_id").on(table.agentId),
        index("idx_sessions_invalidated_at").on(table.invalidatedAt)
    ]
);

export const sessionHistoryTable = sqliteTable(
    "session_history",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        sessionId: text("session_id")
            .notNull()
            .references(() => sessionsTable.id, { onDelete: "cascade" }),
        type: text("type").notNull(),
        at: integer("at").notNull(),
        data: text("data").notNull()
    },
    (table) => [index("idx_session_history_session").on(table.sessionId)]
);

export const inboxTable = sqliteTable(
    "inbox",
    {
        id: text("id").primaryKey(),
        agentId: text("agent_id").notNull(),
        postedAt: integer("posted_at").notNull(),
        type: text("type").notNull(),
        data: text("data").notNull()
    },
    (table) => [index("idx_inbox_agent_order").on(table.agentId, table.postedAt)]
);

export const tasksTable = sqliteTable(
    "tasks",
    {
        id: text("id").notNull(),
        userId: text("user_id").notNull(),
        title: text("title").notNull(),
        description: text("description"),
        code: text("code").notNull(),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull(),
        deletedAt: integer("deleted_at")
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.id] }),
        index("idx_tasks_user_id").on(table.userId),
        index("idx_tasks_updated_at").on(table.updatedAt)
    ]
);

export const tasksCronTable = sqliteTable(
    "tasks_cron",
    {
        id: text("id").primaryKey(),
        taskId: text("task_id").notNull(),
        userId: text("user_id").notNull(),
        name: text("name").notNull(),
        description: text("description"),
        schedule: text("schedule").notNull(),
        agentId: text("agent_id"),
        enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
        deleteAfterRun: integer("delete_after_run", { mode: "boolean" }).notNull().default(false),
        lastRunAt: integer("last_run_at"),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull()
    },
    (table) => [
        foreignKey({
            columns: [table.userId, table.taskId],
            foreignColumns: [tasksTable.userId, tasksTable.id]
        }),
        index("idx_tasks_cron_enabled").on(table.enabled),
        index("idx_tasks_cron_task_id").on(table.userId, table.taskId),
        index("idx_tasks_cron_updated_at").on(table.updatedAt)
    ]
);

export const tasksHeartbeatTable = sqliteTable(
    "tasks_heartbeat",
    {
        id: text("id").primaryKey(),
        taskId: text("task_id").notNull(),
        userId: text("user_id").notNull(),
        title: text("title").notNull(),
        lastRunAt: integer("last_run_at"),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull()
    },
    (table) => [
        foreignKey({
            columns: [table.userId, table.taskId],
            foreignColumns: [tasksTable.userId, tasksTable.id]
        }),
        index("idx_tasks_heartbeat_task_id").on(table.userId, table.taskId),
        index("idx_tasks_heartbeat_updated_at").on(table.updatedAt),
        index("idx_tasks_heartbeat_user_id").on(table.userId)
    ]
);

export const signalsEventsTable = sqliteTable(
    "signals_events",
    {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull(),
        type: text("type").notNull(),
        source: text("source").notNull(),
        data: text("data"),
        createdAt: integer("created_at").notNull()
    },
    (table) => [
        index("idx_signals_events_user").on(table.userId),
        index("idx_signals_events_type").on(table.type),
        index("idx_signals_events_created").on(table.createdAt)
    ]
);

export const signalsSubscriptionsTable = sqliteTable(
    "signals_subscriptions",
    {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull(),
        agentId: text("agent_id").notNull(),
        pattern: text("pattern").notNull(),
        silent: integer("silent", { mode: "boolean" }).notNull().default(false),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull()
    },
    (table) => [
        uniqueIndex("signals_subscriptions_user_agent_pattern_unique").on(table.userId, table.agentId, table.pattern),
        index("idx_signals_subscriptions_user_agent").on(table.userId, table.agentId)
    ]
);

export const signalsDelayedTable = sqliteTable(
    "signals_delayed",
    {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull(),
        type: text("type").notNull(),
        deliverAt: integer("deliver_at").notNull(),
        source: text("source").notNull(),
        data: text("data"),
        repeatKey: text("repeat_key"),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull()
    },
    (table) => [index("idx_signals_delayed_deliver").on(table.deliverAt)]
);

export const channelsTable = sqliteTable(
    "channels",
    {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull(),
        name: text("name").notNull().unique(),
        leader: text("leader").notNull(),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull()
    },
    (table) => [index("idx_channels_name").on(table.name), index("idx_channels_user").on(table.userId)]
);

export const channelMembersTable = sqliteTable(
    "channel_members",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        channelId: text("channel_id")
            .notNull()
            .references(() => channelsTable.id, { onDelete: "cascade" }),
        userId: text("user_id").notNull(),
        agentId: text("agent_id").notNull(),
        username: text("username").notNull(),
        joinedAt: integer("joined_at").notNull()
    },
    (table) => [
        uniqueIndex("channel_members_channel_agent_unique").on(table.channelId, table.agentId),
        index("idx_channel_members_channel").on(table.channelId)
    ]
);

export const channelMessagesTable = sqliteTable(
    "channel_messages",
    {
        id: text("id").primaryKey(),
        channelId: text("channel_id")
            .notNull()
            .references(() => channelsTable.id, { onDelete: "cascade" }),
        userId: text("user_id").notNull(),
        senderUsername: text("sender_username").notNull(),
        text: text("text").notNull(),
        mentions: text("mentions").notNull(),
        createdAt: integer("created_at").notNull()
    },
    (table) => [index("idx_channel_messages_channel_created").on(table.channelId, table.createdAt)]
);

export const exposeEndpointsTable = sqliteTable(
    "expose_endpoints",
    {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull(),
        target: text("target").notNull(),
        provider: text("provider").notNull(),
        domain: text("domain").notNull(),
        mode: text("mode").notNull(),
        auth: text("auth"),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull()
    },
    (table) => [
        index("idx_expose_endpoints_domain").on(table.domain),
        index("idx_expose_endpoints_user").on(table.userId)
    ]
);

export const processesTable = sqliteTable(
    "processes",
    {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull(),
        name: text("name").notNull(),
        command: text("command").notNull(),
        cwd: text("cwd").notNull(),
        home: text("home"),
        env: text("env").notNull(),
        packageManagers: text("package_managers").notNull(),
        allowedDomains: text("allowed_domains").notNull(),
        allowLocalBinding: integer("allow_local_binding", { mode: "boolean" }).notNull().default(false),
        permissions: text("permissions").notNull(),
        owner: text("owner"),
        keepAlive: integer("keep_alive", { mode: "boolean" }).notNull().default(false),
        desiredState: text("desired_state").notNull().default("running"),
        status: text("status").notNull().default("running"),
        pid: integer("pid"),
        bootTimeMs: integer("boot_time_ms"),
        restartCount: integer("restart_count").notNull().default(0),
        restartFailureCount: integer("restart_failure_count").notNull().default(0),
        nextRestartAt: integer("next_restart_at"),
        settingsPath: text("settings_path").notNull(),
        logPath: text("log_path").notNull(),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull(),
        lastStartedAt: integer("last_started_at"),
        lastExitedAt: integer("last_exited_at")
    },
    (table) => [index("idx_processes_owner").on(table.owner), index("idx_processes_user").on(table.userId)]
);

export const connectionsTable = sqliteTable(
    "connections",
    {
        userAId: text("user_a_id")
            .notNull()
            .references(() => usersTable.id, { onDelete: "cascade" }),
        userBId: text("user_b_id")
            .notNull()
            .references(() => usersTable.id, { onDelete: "cascade" }),
        requestedA: integer("requested_a", { mode: "boolean" }).notNull().default(false),
        requestedB: integer("requested_b", { mode: "boolean" }).notNull().default(false),
        requestedAAt: integer("requested_a_at"),
        requestedBAt: integer("requested_b_at")
    },
    (table) => [
        primaryKey({ columns: [table.userAId, table.userBId] }),
        check("connections_user_order", sql`${table.userAId} < ${table.userBId}`),
        index("idx_connections_user_b").on(table.userBId)
    ]
);

export const systemPromptsTable = sqliteTable(
    "system_prompts",
    {
        id: text("id").primaryKey(),
        scope: text("scope").notNull(),
        userId: text("user_id"),
        kind: text("kind").notNull(),
        condition: text("condition"),
        prompt: text("prompt").notNull(),
        enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull()
    },
    (table) => [index("idx_system_prompts_scope").on(table.scope), index("idx_system_prompts_user_id").on(table.userId)]
);

export const tokenStatsHourlyTable = sqliteTable(
    "token_stats_hourly",
    {
        hourStart: integer("hour_start").notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => usersTable.id, { onDelete: "cascade" }),
        agentId: text("agent_id")
            .notNull()
            .references(() => agentsTable.id, { onDelete: "cascade" }),
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
    tokenStatsHourlyTable
};

export type DaycareDb = BetterSQLite3Database<typeof schema>;
export type DaycareDatabaseClient = Database.Database;

export function schemaDrizzleBuild(client: DaycareDatabaseClient): DaycareDb {
    return drizzle(client, {
        schema
    });
}
