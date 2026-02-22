import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import matter from "gray-matter";
import { cuid2Is } from "../../utils/cuid2Is.js";
import { stringSlugify } from "../../utils/stringSlugify.js";
import { databasePathResolve } from "../databasePathResolve.js";
import type { Migration } from "./migrationTypes.js";

export const migration20260220ImportTasks: Migration = {
    name: "20260220_import_tasks",
    up(db): void {
        const dbPath = databasePathResolve(db);
        if (!dbPath) {
            return;
        }

        const configDir = path.dirname(dbPath);
        const ownerUserId = ownerUserIdResolve(db);
        cronTasksImport(db, path.join(configDir, "cron"), ownerUserId);
        heartbeatTasksImport(db, path.join(configDir, "heartbeat"));
    }
};

function cronTasksImport(db: Pick<DatabaseSync, "prepare">, cronDir: string, ownerUserId: string | null): void {
    if (!existsSync(cronDir)) {
        return;
    }

    const entries = readdirSync(cronDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const taskId = entry.name;
        const taskDir = path.join(cronDir, taskId);
        const taskPath = path.join(taskDir, "TASK.md");
        if (!existsSync(taskPath)) {
            continue;
        }

        let raw = "";
        try {
            raw = readFileSync(taskPath, "utf8");
        } catch {
            continue;
        }
        const parsed = matter(raw);
        const frontmatter = parsed.data as Record<string, unknown>;

        const taskUid = frontmatterTaskUidResolve(frontmatter);
        const name = stringOptionalResolve(frontmatter.name);
        const schedule = stringOptionalResolve(frontmatter.schedule ?? frontmatter.cron);
        if (!taskUid || !name || !schedule) {
            continue;
        }

        const deleteAfterRun = booleanFromAliases(frontmatter, [
            "deleteAfterRun",
            "delete_after_run",
            "oneOff",
            "one_off",
            "once"
        ]);
        const prompt = parsed.content.trim();
        if (!prompt) {
            continue;
        }
        const description = stringOptionalResolve(frontmatter.description);
        const userId =
            stringOptionalResolve(
                frontmatter.userId ?? frontmatter.user_id ?? frontmatter.userID ?? frontmatter.userid
            ) ?? ownerUserId;
        const agentId = stringOptionalResolve(frontmatter.agentId ?? frontmatter.agent_id);
        const enabled = frontmatter.enabled !== false;
        const lastRunAt = cronLastRunAtResolve(path.join(taskDir, "STATE.json"));
        const timestamps = timestampsResolve(taskPath);

        db.prepare(
            `
          INSERT OR IGNORE INTO tasks_cron (
            id,
            task_uid,
            user_id,
            name,
            description,
            schedule,
            prompt,
            agent_id,
            enabled,
            delete_after_run,
            last_run_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
            taskId,
            taskUid,
            userId,
            name,
            description,
            schedule,
            prompt,
            agentId,
            enabled ? 1 : 0,
            deleteAfterRun ? 1 : 0,
            lastRunAt,
            timestamps.createdAt,
            timestamps.updatedAt
        );
    }
}

function ownerUserIdResolve(db: Pick<DatabaseSync, "prepare">): string | null {
    const row = db.prepare("SELECT id FROM users WHERE is_owner = 1 LIMIT 1").get() as { id?: unknown } | undefined;
    if (typeof row?.id !== "string") {
        return null;
    }
    const trimmed = row.id.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function heartbeatTasksImport(db: Pick<DatabaseSync, "prepare">, heartbeatDir: string): void {
    if (!existsSync(heartbeatDir)) {
        return;
    }

    const sharedLastRunAt = heartbeatLastRunAtResolve(path.join(heartbeatDir, ".heartbeat-state.json"));
    const entries = readdirSync(heartbeatDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) {
            continue;
        }

        const filePath = path.join(heartbeatDir, entry.name);
        let raw = "";
        try {
            raw = readFileSync(filePath, "utf8");
        } catch {
            continue;
        }

        const parsed = matter(raw);
        const baseName = path.basename(filePath, path.extname(filePath));
        const id = stringSlugify(baseName) || baseName;
        const parsedTask = heartbeatContentResolve(parsed.content, parsed.data as Record<string, unknown>, baseName);
        if (!parsedTask.prompt) {
            continue;
        }

        const timestamps = timestampsResolve(filePath);

        db.prepare(
            `
          INSERT OR IGNORE INTO tasks_heartbeat (
            id,
            title,
            prompt,
            last_run_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
        ).run(id, parsedTask.title, parsedTask.prompt, sharedLastRunAt, timestamps.createdAt, timestamps.updatedAt);
    }
}

function frontmatterTaskUidResolve(frontmatter: Record<string, unknown>): string | null {
    const raw = frontmatter.taskId;
    if (typeof raw !== "string") {
        return null;
    }
    const trimmed = raw.trim();
    if (!trimmed || !cuid2Is(trimmed)) {
        return null;
    }
    return trimmed;
}

function stringOptionalResolve(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function booleanFromAliases(frontmatter: Record<string, unknown>, keys: string[]): boolean {
    for (const key of keys) {
        if (frontmatter[key] === true) {
            return true;
        }
    }
    return false;
}

function timestampsResolve(filePath: string): { createdAt: number; updatedAt: number } {
    try {
        const stat = statSync(filePath);
        const createdAt = Number.isFinite(stat.birthtimeMs) ? Math.floor(stat.birthtimeMs) : Math.floor(stat.mtimeMs);
        const updatedAt = Number.isFinite(stat.mtimeMs) ? Math.floor(stat.mtimeMs) : createdAt;
        return {
            createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
            updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now()
        };
    } catch {
        const now = Date.now();
        return { createdAt: now, updatedAt: now };
    }
}

function cronLastRunAtResolve(statePath: string): number | null {
    if (!existsSync(statePath)) {
        return null;
    }

    try {
        const parsed = JSON.parse(readFileSync(statePath, "utf8")) as { lastRunAt?: unknown };
        if (typeof parsed.lastRunAt !== "string") {
            return null;
        }
        const millis = Date.parse(parsed.lastRunAt);
        return Number.isFinite(millis) ? millis : null;
    } catch {
        return null;
    }
}

function heartbeatLastRunAtResolve(statePath: string): number | null {
    if (!existsSync(statePath)) {
        return null;
    }

    try {
        const parsed = JSON.parse(readFileSync(statePath, "utf8")) as { lastRunAt?: unknown };
        if (typeof parsed.lastRunAt !== "string") {
            return null;
        }
        const millis = Date.parse(parsed.lastRunAt);
        return Number.isFinite(millis) ? millis : null;
    } catch {
        return null;
    }
}

function heartbeatContentResolve(
    body: string,
    frontmatter: Record<string, unknown>,
    fallbackTitle: string
): { title: string; prompt: string } {
    const trimmedBody = body.trim();
    const frontmatterTitle = frontmatter.title ?? frontmatter.name;
    if (typeof frontmatterTitle === "string") {
        return {
            title: frontmatterTitle.trim() || fallbackTitle,
            prompt: trimmedBody
        };
    }

    if (trimmedBody.length > 0) {
        const lines = trimmedBody.split(/\r?\n/);
        const firstLine = lines[0]?.trim() ?? "";
        const headingMatch = /^#{1,6}\s+(.*)$/.exec(firstLine);
        if (headingMatch?.[1]) {
            const title = headingMatch[1].trim() || fallbackTitle;
            const prompt = lines.slice(1).join("\n").trim();
            return { title, prompt };
        }
    }

    return {
        title: fallbackTitle,
        prompt: trimmedBody
    };
}
