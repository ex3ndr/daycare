import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { StorageDatabase } from "../databaseOpen.js";
import { databasePathResolve } from "../databasePathResolve.js";
import type { Migration } from "./migrationTypes.js";

export const migration20260222ImportSignals: Migration = {
    name: "20260222_import_signals",
    up(db): void {
        const dbPath = databasePathResolve(db);
        if (!dbPath) {
            return;
        }

        const configDir = path.dirname(dbPath);
        const ownerUserId = ownerUserIdResolve(db);
        const signalsDir = path.join(configDir, "signals");

        signalEventsImport(db, path.join(signalsDir, "events.jsonl"), ownerUserId);
        delayedSignalsImport(db, path.join(signalsDir, "delayed.json"), ownerUserId);
    }
};

type LegacySignalEvent = {
    id?: unknown;
    type?: unknown;
    source?: unknown;
    data?: unknown;
    createdAt?: unknown;
};

function ownerUserIdResolve(db: Pick<StorageDatabase, "prepare">): string {
    const row = db.prepare("SELECT id FROM users WHERE is_owner = 1 LIMIT 1").get() as { id?: unknown } | undefined;
    const ownerId = typeof row?.id === "string" ? row.id.trim() : "";
    return ownerId || "owner";
}

function signalEventsImport(db: Pick<StorageDatabase, "prepare">, eventsPath: string, ownerUserId: string): void {
    if (!existsSync(eventsPath)) {
        return;
    }

    const lines = readFileSync(eventsPath, "utf8").split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        let parsed: LegacySignalEvent | null = null;
        try {
            parsed = JSON.parse(trimmed) as LegacySignalEvent;
        } catch {
            continue;
        }

        const id = stringOrNull(parsed?.id);
        const type = stringOrNull(parsed?.type);
        const createdAt = numberOrNow(parsed?.createdAt);
        if (!id || !type) {
            continue;
        }

        const source = signalSourceNormalize(parsed?.source);
        const userId = source.userId ?? ownerUserId;
        db.prepare(
            `
              INSERT OR IGNORE INTO signals_events (
                id,
                user_id,
                type,
                source,
                data,
                created_at
              ) VALUES (?, ?, ?, ?, ?, ?)
            `
        ).run(
            id,
            userId,
            type,
            JSON.stringify(source),
            parsed?.data === undefined ? null : JSON.stringify(parsed.data),
            createdAt
        );
    }
}

function delayedSignalsImport(db: Pick<StorageDatabase, "prepare">, delayedPath: string, ownerUserId: string): void {
    if (!existsSync(delayedPath)) {
        return;
    }

    let parsed: { events?: unknown } | null = null;
    try {
        parsed = JSON.parse(readFileSync(delayedPath, "utf8")) as { events?: unknown };
    } catch {
        return;
    }

    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.events)) {
        return;
    }

    for (const event of parsed.events) {
        if (!event || typeof event !== "object") {
            continue;
        }
        const candidate = event as {
            id?: unknown;
            type?: unknown;
            source?: unknown;
            data?: unknown;
            deliverAt?: unknown;
            repeatKey?: unknown;
            createdAt?: unknown;
            updatedAt?: unknown;
        };
        const id = stringOrNull(candidate.id);
        const type = stringOrNull(candidate.type);
        if (!id || !type) {
            continue;
        }

        const source = signalSourceNormalize(candidate.source);
        const userId = source.userId ?? ownerUserId;
        const deliverAt = numberOrNow(candidate.deliverAt);
        const createdAt = numberOrNow(candidate.createdAt);
        const updatedAt = numberOrNow(candidate.updatedAt);
        const repeatKey = stringOrNull(candidate.repeatKey);

        db.prepare(
            `
              INSERT OR IGNORE INTO signals_delayed (
                id,
                user_id,
                type,
                deliver_at,
                source,
                data,
                repeat_key,
                created_at,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
        ).run(
            id,
            userId,
            type,
            deliverAt,
            JSON.stringify(source),
            candidate.data === undefined ? null : JSON.stringify(candidate.data),
            repeatKey,
            createdAt,
            updatedAt
        );
    }
}

function stringOrNull(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function numberOrNow(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return Date.now();
}

function signalSourceNormalize(source: unknown): {
    type: "system" | "agent" | "webhook" | "process";
    id?: string;
    userId?: string;
} {
    if (!source || typeof source !== "object") {
        return { type: "system" };
    }
    const candidate = source as { type?: unknown; id?: unknown; userId?: unknown };
    const userId = stringOrNull(candidate.userId) ?? undefined;

    if (candidate.type === "agent") {
        const id = stringOrNull(candidate.id);
        if (id) {
            return userId ? { type: "agent", id, userId } : { type: "agent", id };
        }
        return userId ? { type: "system", userId } : { type: "system" };
    }
    if (candidate.type === "webhook") {
        const id = stringOrNull(candidate.id) ?? undefined;
        return userId ? { type: "webhook", ...(id ? { id } : {}), userId } : { type: "webhook", ...(id ? { id } : {}) };
    }
    if (candidate.type === "process") {
        const id = stringOrNull(candidate.id) ?? undefined;
        return userId ? { type: "process", ...(id ? { id } : {}), userId } : { type: "process", ...(id ? { id } : {}) };
    }
    return userId ? { type: "system", userId } : { type: "system" };
}
