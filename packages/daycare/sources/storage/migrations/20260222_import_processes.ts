import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { StorageDatabase } from "../databaseOpen.js";
import { databasePathResolve } from "../databasePathResolve.js";
import type { Migration } from "./migrationTypes.js";

export const migration20260222ImportProcesses: Migration = {
    name: "20260222_import_processes",
    up(db): void {
        const dbPath = databasePathResolve(db);
        if (!dbPath) {
            return;
        }

        const dataDir = path.dirname(dbPath);
        const processesDir = path.join(dataDir, "processes");
        if (!existsSync(processesDir)) {
            return;
        }

        const ownerUserId = ownerUserIdResolve(db);
        const entries = readdirSync(processesDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const record = processRecordRead(path.join(processesDir, entry.name, "record.json"));
            if (!record) {
                continue;
            }

            const ownerAgentId = record.owner?.id ?? null;
            const ownerResolvedUserId = ownerAgentId ? agentUserIdResolve(db, ownerAgentId) : null;
            const userId = ownerResolvedUserId ?? ownerUserId;

            db.prepare(
                `
                  INSERT OR IGNORE INTO processes (
                    id,
                    user_id,
                    name,
                    command,
                    cwd,
                    home,
                    env,
                    package_managers,
                    allowed_domains,
                    allow_local_binding,
                    permissions,
                    owner,
                    keep_alive,
                    desired_state,
                    status,
                    pid,
                    boot_time_ms,
                    restart_count,
                    restart_failure_count,
                    next_restart_at,
                    settings_path,
                    log_path,
                    created_at,
                    updated_at,
                    last_started_at,
                    last_exited_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
            ).run(
                record.id,
                userId,
                record.name,
                record.command,
                record.cwd,
                record.home,
                JSON.stringify(record.env),
                JSON.stringify(record.packageManagers),
                JSON.stringify(record.allowedDomains),
                record.allowLocalBinding ? 1 : 0,
                JSON.stringify(record.permissions),
                record.owner ? JSON.stringify(record.owner) : null,
                record.keepAlive ? 1 : 0,
                record.desiredState,
                record.status,
                record.pid,
                record.bootTimeMs,
                record.restartCount,
                record.restartFailureCount,
                record.nextRestartAt,
                record.settingsPath,
                record.logPath,
                record.createdAt,
                record.updatedAt,
                record.lastStartedAt,
                record.lastExitedAt
            );
        }
    }
};

function ownerUserIdResolve(db: Pick<StorageDatabase, "prepare">): string {
    const row = db.prepare("SELECT id FROM users WHERE is_owner = 1 LIMIT 1").get() as { id?: unknown } | undefined;
    const ownerId = typeof row?.id === "string" ? row.id.trim() : "";
    return ownerId || "owner";
}

function agentUserIdResolve(db: Pick<StorageDatabase, "prepare">, agentId: string): string | null {
    const row = db.prepare("SELECT user_id FROM agents WHERE id = ? LIMIT 1").get(agentId) as
        | { user_id?: unknown }
        | undefined;
    if (typeof row?.user_id !== "string") {
        return null;
    }
    const userId = row.user_id.trim();
    return userId.length > 0 ? userId : null;
}

function processRecordRead(filePath: string): {
    id: string;
    name: string;
    command: string;
    cwd: string;
    home: string | null;
    env: Record<string, string>;
    packageManagers: string[];
    allowedDomains: string[];
    allowLocalBinding: boolean;
    permissions: { workingDir: string; writeDirs: string[]; readDirs: string[]; network: boolean; events: boolean };
    owner: { type: "plugin"; id: string } | null;
    keepAlive: boolean;
    desiredState: "running" | "stopped";
    status: "running" | "stopped" | "exited";
    pid: number | null;
    bootTimeMs: number | null;
    restartCount: number;
    restartFailureCount: number;
    nextRestartAt: number | null;
    settingsPath: string;
    logPath: string;
    createdAt: number;
    updatedAt: number;
    lastStartedAt: number | null;
    lastExitedAt: number | null;
} | null {
    if (!existsSync(filePath)) {
        return null;
    }

    try {
        const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
            version?: unknown;
            id?: unknown;
            name?: unknown;
            command?: unknown;
            cwd?: unknown;
            home?: unknown;
            env?: unknown;
            packageManagers?: unknown;
            allowedDomains?: unknown;
            allowLocalBinding?: unknown;
            permissions?: unknown;
            owner?: unknown;
            keepAlive?: unknown;
            desiredState?: unknown;
            status?: unknown;
            pid?: unknown;
            bootTimeMs?: unknown;
            restartCount?: unknown;
            restartFailureCount?: unknown;
            nextRestartAt?: unknown;
            settingsPath?: unknown;
            logPath?: unknown;
            createdAt?: unknown;
            updatedAt?: unknown;
            lastStartedAt?: unknown;
            lastExitedAt?: unknown;
        };
        if (parsed.version !== 2) {
            return null;
        }

        const id = stringOrNull(parsed.id);
        const name = stringOrNull(parsed.name);
        const command = stringOrNull(parsed.command);
        const cwd = stringOrNull(parsed.cwd);
        const settingsPath = stringOrNull(parsed.settingsPath);
        const logPath = stringOrNull(parsed.logPath);
        if (!id || !name || !command || !cwd || !settingsPath || !logPath) {
            return null;
        }

        return {
            id,
            name,
            command,
            cwd,
            home: stringOrNull(parsed.home),
            env: envParse(parsed.env),
            packageManagers: stringArrayParse(parsed.packageManagers),
            allowedDomains: stringArrayParse(parsed.allowedDomains),
            allowLocalBinding: parsed.allowLocalBinding === true,
            permissions: permissionsParse(parsed.permissions),
            owner: ownerParse(parsed.owner),
            keepAlive: parsed.keepAlive === true,
            desiredState: parsed.desiredState === "stopped" ? "stopped" : "running",
            status:
                parsed.status === "running" || parsed.status === "stopped" || parsed.status === "exited"
                    ? parsed.status
                    : "stopped",
            pid: numberOrNull(parsed.pid),
            bootTimeMs: numberOrNull(parsed.bootTimeMs),
            restartCount: numberOrZero(parsed.restartCount),
            restartFailureCount: numberOrZero(parsed.restartFailureCount),
            nextRestartAt: numberOrNull(parsed.nextRestartAt),
            settingsPath,
            logPath,
            createdAt: numberOrNow(parsed.createdAt),
            updatedAt: numberOrNow(parsed.updatedAt),
            lastStartedAt: numberOrNull(parsed.lastStartedAt),
            lastExitedAt: numberOrNull(parsed.lastExitedAt)
        };
    } catch {
        return null;
    }
}

function stringOrNull(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function stringArrayParse(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry): entry is string => typeof entry === "string");
}

function envParse(value: unknown): Record<string, string> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    const entries = Object.entries(value).filter(
        (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
    );
    return Object.fromEntries(entries);
}

function permissionsParse(value: unknown): {
    workingDir: string;
    writeDirs: string[];
    readDirs: string[];
    network: boolean;
    events: boolean;
} {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { workingDir: "/", writeDirs: [], readDirs: [], network: false, events: false };
    }
    const parsed = value as {
        workingDir?: unknown;
        writeDirs?: unknown;
        readDirs?: unknown;
        network?: unknown;
        events?: unknown;
    };
    return {
        workingDir: stringOrNull(parsed.workingDir) ?? "/",
        writeDirs: stringArrayParse(parsed.writeDirs),
        readDirs: stringArrayParse(parsed.readDirs),
        network: parsed.network === true,
        events: parsed.events === true
    };
}

function ownerParse(value: unknown): { type: "plugin"; id: string } | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const parsed = value as { type?: unknown; id?: unknown };
    const id = stringOrNull(parsed.id);
    if (parsed.type !== "plugin" || !id) {
        return null;
    }
    return { type: "plugin", id };
}

function numberOrNull(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.floor(value);
    }
    return null;
}

function numberOrZero(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.floor(value);
    }
    return 0;
}

function numberOrNow(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return Date.now();
}
