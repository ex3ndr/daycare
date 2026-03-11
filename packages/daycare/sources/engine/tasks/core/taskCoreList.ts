import { promises as fs } from "node:fs";
import path from "node:path";
import type { TaskDbRecord } from "../../../storage/databaseTypes.js";
import { taskCoreResolve } from "./taskCoreResolve.js";
import { taskCoreRootResolve } from "./taskCoreRootResolve.js";

/**
 * Lists bundled core tasks as user-scoped virtual task records.
 * Expects: root may be missing; that case returns an empty list.
 */
export async function taskCoreList(options: { userId: string; root?: string }): Promise<TaskDbRecord[]> {
    const userId = options.userId.trim();
    if (!userId) {
        return [];
    }

    const root = options.root ?? taskCoreRootResolve();
    let entries: Array<import("node:fs").Dirent> = [];
    try {
        entries = await fs.readdir(root, { withFileTypes: true });
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR") {
            return [];
        }
        throw error;
    }

    const records: TaskDbRecord[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        const task = await taskCoreResolve({
            taskId: `core:${path.basename(entry.name)}`,
            userId,
            root
        });
        if (task) {
            records.push(task);
        }
    }

    return records.sort((left, right) => left.id.localeCompare(right.id));
}
