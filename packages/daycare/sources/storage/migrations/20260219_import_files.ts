import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import type { AgentDescriptor, AgentHistoryRecord, AgentState } from "@/types";
import type { Migration } from "./migrationTypes.js";

type LegacyState = Pick<
    AgentState,
    "inferenceSessionId" | "permissions" | "tokens" | "stats" | "createdAt" | "updatedAt" | "state"
>;
type LegacyHistoryMarker = { type: "start"; at: number } | { type: "reset"; at: number; message?: string };
type LegacyHistoryRecord = LegacyHistoryMarker | AgentHistoryRecord;

export const migration20260219ImportFiles: Migration = {
    name: "20260219_import_files",
    up(db): void {
        const existing = db.prepare("SELECT COUNT(*) AS count FROM agents").get() as { count?: number } | undefined;
        if ((existing?.count ?? 0) > 0) {
            return;
        }

        const dbPath = databasePathResolve(db);
        if (!dbPath) {
            return;
        }

        const dataDir = path.dirname(dbPath);
        const agentsDir = path.join(dataDir, "agents");
        if (!existsSync(agentsDir)) {
            return;
        }

        const entries = readdirSync(agentsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            const agentId = entry.name;
            const basePath = path.join(agentsDir, agentId);
            const descriptor = legacyDescriptorRead(basePath);
            const state = legacyStateRead(basePath);
            if (!descriptor || !state) {
                continue;
            }

            db.prepare(
                `
          INSERT INTO agents (
            id,
            type,
            descriptor,
            active_session_id,
            permissions,
            tokens,
            stats,
            lifecycle,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            type = excluded.type,
            descriptor = excluded.descriptor,
            permissions = excluded.permissions,
            tokens = excluded.tokens,
            stats = excluded.stats,
            lifecycle = excluded.lifecycle,
            updated_at = excluded.updated_at
        `
            ).run(
                agentId,
                descriptor.type,
                JSON.stringify(descriptor),
                JSON.stringify(state.permissions),
                state.tokens ? JSON.stringify(state.tokens) : null,
                JSON.stringify(state.stats),
                state.state,
                state.createdAt,
                state.updatedAt
            );

            const historyRecords = legacyHistoryRead(path.join(basePath, "history.jsonl"));
            const sessions = legacySessionsBuild(historyRecords, state);

            for (const session of sessions) {
                db.prepare(
                    `
            INSERT INTO sessions (
              id,
              agent_id,
              inference_session_id,
              created_at,
              reset_message
            ) VALUES (?, ?, ?, ?, ?)
          `
                ).run(session.id, agentId, session.inferenceSessionId, session.createdAt, session.resetMessage);

                for (const record of session.records) {
                    const { type, at, ...data } = record;
                    db.prepare(
                        `
              INSERT INTO session_history (session_id, type, at, data)
              VALUES (?, ?, ?, ?)
            `
                    ).run(session.id, type, at, JSON.stringify(data));
                }
            }

            const activeSessionId = sessions[sessions.length - 1]?.id ?? null;
            db.prepare("UPDATE agents SET active_session_id = ? WHERE id = ?").run(activeSessionId, agentId);
        }
    }
};

function databasePathResolve(db: { prepare: (sql: string) => { all: () => unknown[] } }): string | null {
    const rows = db.prepare("PRAGMA database_list").all() as Array<{ name?: string; file?: string }>;
    const main = rows.find((row) => row.name === "main") ?? rows[0];
    const file = main?.file?.trim() ?? "";
    return file.length > 0 ? file : null;
}

function legacyDescriptorRead(basePath: string): AgentDescriptor | null {
    const filePath = path.join(basePath, "descriptor.json");
    try {
        const raw = readFileSync(filePath, "utf8");
        return JSON.parse(raw) as AgentDescriptor;
    } catch {
        return null;
    }
}

function legacyStateRead(basePath: string): LegacyState | null {
    const filePath = path.join(basePath, "state.json");
    try {
        const raw = readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw) as Partial<LegacyState> & { sleeping?: boolean };
        return {
            inferenceSessionId: typeof parsed.inferenceSessionId === "string" ? parsed.inferenceSessionId : undefined,
            permissions: parsed.permissions ?? {
                workingDir: "/",
                writeDirs: [],
                readDirs: [],
                network: false,
                events: false
            },
            tokens: parsed.tokens ?? null,
            stats: parsed.stats ?? {},
            createdAt:
                typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt)
                    ? parsed.createdAt
                    : Date.now(),
            updatedAt:
                typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
                    ? parsed.updatedAt
                    : Date.now(),
            state:
                parsed.state === "active" || parsed.state === "sleeping" || parsed.state === "dead"
                    ? parsed.state
                    : parsed.sleeping
                      ? "sleeping"
                      : "active"
        };
    } catch {
        return null;
    }
}

function legacyHistoryRead(filePath: string): LegacyHistoryRecord[] {
    if (!existsSync(filePath)) {
        return [];
    }

    const records: LegacyHistoryRecord[] = [];
    const lines = readFileSync(filePath, "utf8").split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        try {
            const parsed = JSON.parse(trimmed) as LegacyHistoryRecord;
            records.push(parsed);
        } catch {}
    }

    return records;
}

type LegacySession = {
    id: string;
    inferenceSessionId: string | null;
    createdAt: number;
    resetMessage: string | null;
    records: AgentHistoryRecord[];
};

function legacySessionsBuild(records: LegacyHistoryRecord[], state: LegacyState): LegacySession[] {
    if (records.length === 0) {
        return [
            {
                id: createId(),
                inferenceSessionId: state.inferenceSessionId ?? null,
                createdAt: state.createdAt,
                resetMessage: null,
                records: []
            }
        ];
    }

    const sessions: LegacySession[] = [];
    let current: LegacySession | null = null;

    const sessionEnsure = (createdAt: number, resetMessage: string | null): LegacySession => {
        const session: LegacySession = {
            id: createId(),
            inferenceSessionId: null,
            createdAt,
            resetMessage,
            records: []
        };
        sessions.push(session);
        current = session;
        return session;
    };

    for (const record of records) {
        if (record.type === "start") {
            sessionEnsure(record.at, null);
            continue;
        }
        if (record.type === "reset") {
            sessionEnsure(record.at, record.message ?? null);
            continue;
        }
        const target = current ?? sessionEnsure(record.at, null);
        target.records.push(record);
    }

    const last = sessions[sessions.length - 1];
    if (last) {
        last.inferenceSessionId = state.inferenceSessionId ?? null;
    }

    return sessions.length > 0
        ? sessions
        : [
              {
                  id: createId(),
                  inferenceSessionId: state.inferenceSessionId ?? null,
                  createdAt: state.createdAt,
                  resetMessage: null,
                  records: []
              }
          ];
}
