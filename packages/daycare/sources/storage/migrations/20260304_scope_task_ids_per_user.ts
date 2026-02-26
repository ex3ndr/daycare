import type { Migration } from "./migrationTypes.js";

/**
 * Scopes task and trigger ids by user with composite primary keys.
 * Expects: tasks, tasks_cron, and tasks_heartbeat tables already exist.
 */
export const migration20260304ScopeTaskIdsPerUser: Migration = {
    name: "20260304_scope_task_ids_per_user",
    up(db): void {
        const taskColumns = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string; pk: number }>;
        if (taskColumns.length === 0) {
            return;
        }
        const cronColumns = db.prepare("PRAGMA table_info(tasks_cron)").all() as Array<{ name: string }>;
        const heartbeatColumns = db.prepare("PRAGMA table_info(tasks_heartbeat)").all() as Array<{ name: string }>;
        const cronHasCode = cronColumns.some((column) => column.name === "code");
        const heartbeatHasCode = heartbeatColumns.some((column) => column.name === "code");

        const alreadyScopedTasks = primaryKeyIs(taskColumns, ["user_id", "id"]);
        const alreadyScopedCron = tableHasScopedTaskForeignKey(db, "tasks_cron");
        const alreadyScopedHeartbeat = tableHasScopedTaskForeignKey(db, "tasks_heartbeat");
        if (alreadyScopedTasks && alreadyScopedCron && alreadyScopedHeartbeat) {
            return;
        }

        const missingTaskUser = db
            .prepare("SELECT id FROM tasks WHERE user_id IS NULL OR TRIM(user_id) = '' LIMIT 1")
            .get() as { id?: unknown } | undefined;
        if (typeof missingTaskUser?.id === "string" && missingTaskUser.id.trim()) {
            throw new Error(`Cannot scope tasks by user; task ${missingTaskUser.id} has no user_id.`);
        }

        const duplicateTask = db
            .prepare(
                `
                SELECT user_id, id
                FROM tasks
                GROUP BY user_id, id
                HAVING COUNT(1) > 1
                LIMIT 1
                `
            )
            .get() as { user_id?: unknown; id?: unknown } | undefined;
        if (typeof duplicateTask?.user_id === "string" && typeof duplicateTask.id === "string") {
            throw new Error(
                `Cannot scope tasks by user; duplicate task id ${duplicateTask.id} already exists for user ${duplicateTask.user_id}.`
            );
        }

        db.exec(`
                CREATE TABLE tasks_next (
                    id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    code TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    deleted_at INTEGER,
                    PRIMARY KEY (user_id, id)
                );

                INSERT INTO tasks_next (
                    id,
                    user_id,
                    title,
                    description,
                    code,
                    created_at,
                    updated_at,
                    deleted_at
                )
                SELECT
                    id,
                    user_id,
                    title,
                    description,
                    code,
                    created_at,
                    updated_at,
                    deleted_at
                FROM tasks;
            `);

        db.exec(cronMigrationSql(cronHasCode));
        db.exec(cronCopySql(cronHasCode));
        db.exec(heartbeatMigrationSql(heartbeatHasCode));
        db.exec(heartbeatCopySql(heartbeatHasCode));

        const cronMissingUser = db
            .prepare("SELECT id FROM tasks_cron_next WHERE user_id IS NULL OR TRIM(user_id) = '' LIMIT 1")
            .get() as { id?: unknown } | undefined;
        if (typeof cronMissingUser?.id === "string" && cronMissingUser.id.trim()) {
            throw new Error(`Cannot scope cron trigger ${cronMissingUser.id}; no user_id could be resolved.`);
        }

        const heartbeatMissingUser = db
            .prepare("SELECT id FROM tasks_heartbeat_next WHERE user_id IS NULL OR TRIM(user_id) = '' LIMIT 1")
            .get() as { id?: unknown } | undefined;
        if (typeof heartbeatMissingUser?.id === "string" && heartbeatMissingUser.id.trim()) {
            throw new Error(`Cannot scope heartbeat trigger ${heartbeatMissingUser.id}; no user_id could be resolved.`);
        }

        const cronOrphan = db
            .prepare(
                `
                SELECT c.id
                FROM tasks_cron_next c
                LEFT JOIN tasks_next t ON t.user_id = c.user_id AND t.id = c.task_id
                WHERE t.id IS NULL
                LIMIT 1
                `
            )
            .get() as { id?: unknown } | undefined;
        if (typeof cronOrphan?.id === "string" && cronOrphan.id.trim()) {
            throw new Error(`Cannot scope cron trigger ${cronOrphan.id}; task reference is missing in user scope.`);
        }

        const heartbeatOrphan = db
            .prepare(
                `
                SELECT h.id
                FROM tasks_heartbeat_next h
                LEFT JOIN tasks_next t ON t.user_id = h.user_id AND t.id = h.task_id
                WHERE t.id IS NULL
                LIMIT 1
                `
            )
            .get() as { id?: unknown } | undefined;
        if (typeof heartbeatOrphan?.id === "string" && heartbeatOrphan.id.trim()) {
            throw new Error(`Cannot scope heartbeat trigger ${heartbeatOrphan.id}; task reference is missing in user scope.`);
        }

        db.exec(`
                DROP TABLE tasks_cron;
                DROP TABLE tasks_heartbeat;
                DROP TABLE tasks;

                ALTER TABLE tasks_next RENAME TO tasks;
                ALTER TABLE tasks_cron_next RENAME TO tasks_cron;
                ALTER TABLE tasks_heartbeat_next RENAME TO tasks_heartbeat;

                CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
                CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);

                CREATE INDEX IF NOT EXISTS idx_tasks_cron_enabled ON tasks_cron(enabled);
                CREATE INDEX IF NOT EXISTS idx_tasks_cron_updated_at ON tasks_cron(updated_at);
                CREATE INDEX IF NOT EXISTS idx_tasks_cron_task_id ON tasks_cron(user_id, task_id);

                CREATE INDEX IF NOT EXISTS idx_tasks_heartbeat_user_id ON tasks_heartbeat(user_id);
                CREATE INDEX IF NOT EXISTS idx_tasks_heartbeat_updated_at ON tasks_heartbeat(updated_at);
                CREATE INDEX IF NOT EXISTS idx_tasks_heartbeat_task_id ON tasks_heartbeat(user_id, task_id);
            `);
    }
};

function primaryKeyIs(columns: Array<{ name: string; pk: number }>, expected: string[]): boolean {
    const ordered = columns
        .filter((column) => column.pk > 0)
        .sort((left, right) => left.pk - right.pk)
        .map((column) => column.name);
    if (ordered.length !== expected.length) {
        return false;
    }
    return ordered.every((columnName, index) => columnName === expected[index]);
}

function tableHasScopedTaskForeignKey(db: Pick<Parameters<Migration["up"]>[0], "prepare">, tableName: string): boolean {
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${tableName})`).all() as Array<{
        table: string;
        from: string;
        to: string;
    }>;
    const taskIdFk = foreignKeys.some(
        (foreignKey) => foreignKey.table === "tasks" && foreignKey.from === "task_id" && foreignKey.to === "id"
    );
    const userIdFk = foreignKeys.some(
        (foreignKey) => foreignKey.table === "tasks" && foreignKey.from === "user_id" && foreignKey.to === "user_id"
    );
    return taskIdFk && userIdFk;
}

function cronMigrationSql(includeCode: boolean): string {
    const codeColumn = includeCode ? "\n                    code TEXT NOT NULL," : "";
    return `
        CREATE TABLE tasks_cron_next (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            schedule TEXT NOT NULL,${codeColumn}
            agent_id TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            delete_after_run INTEGER NOT NULL DEFAULT 0,
            last_run_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (user_id, task_id) REFERENCES tasks_next(user_id, id)
        );
    `;
}

function cronCopySql(includeCode: boolean): string {
    const codeColumn = includeCode ? ",\n            code" : "";
    const codeSelect = includeCode ? ",\n            c.code" : "";
    return `
        INSERT INTO tasks_cron_next (
            id,
            task_id,
            user_id,
            name,
            description,
            schedule${codeColumn},
            agent_id,
            enabled,
            delete_after_run,
            last_run_at,
            created_at,
            updated_at
        )
        SELECT
            c.id,
            c.task_id,
            COALESCE(NULLIF(TRIM(c.user_id), ''), t.user_id) AS user_id,
            c.name,
            c.description,
            c.schedule${codeSelect},
            c.agent_id,
            c.enabled,
            c.delete_after_run,
            c.last_run_at,
            c.created_at,
            c.updated_at
        FROM tasks_cron c
        LEFT JOIN tasks t ON t.id = c.task_id;
    `;
}

function heartbeatMigrationSql(includeCode: boolean): string {
    const codeColumn = includeCode ? "\n            code TEXT NOT NULL," : "";
    return `
        CREATE TABLE tasks_heartbeat_next (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,${codeColumn}
            last_run_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (user_id, task_id) REFERENCES tasks_next(user_id, id)
        );
    `;
}

function heartbeatCopySql(includeCode: boolean): string {
    const codeColumn = includeCode ? ",\n            code" : "";
    const codeSelect = includeCode ? ",\n            h.code" : "";
    return `
        INSERT INTO tasks_heartbeat_next (
            id,
            task_id,
            user_id,
            title${codeColumn},
            last_run_at,
            created_at,
            updated_at
        )
        SELECT
            h.id,
            h.task_id,
            COALESCE(NULLIF(TRIM(h.user_id), ''), t.user_id) AS user_id,
            h.title${codeSelect},
            h.last_run_at,
            h.created_at,
            h.updated_at
        FROM tasks_heartbeat h
        LEFT JOIN tasks t ON t.id = h.task_id;
    `;
}
