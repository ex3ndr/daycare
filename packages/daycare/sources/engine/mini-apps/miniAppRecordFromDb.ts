import type { MiniAppDbRecord } from "@/types";
import type { MiniAppRecord } from "./miniAppTypes.js";

/**
 * Maps a storage row into the public mini-app record shape used by routes and tools.
 * Expects: record.version is present on active rows loaded from the repository.
 */
export function miniAppRecordFromDb(record: MiniAppDbRecord): MiniAppRecord {
    return {
        id: record.id,
        userId: record.userId,
        version: record.version ?? 1,
        codeVersion: record.codeVersion,
        title: record.title,
        icon: record.icon,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}
