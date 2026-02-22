import type { Config } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { BackgroundAgentState } from "./agentTypes.js";

/**
 * Lists persisted background agents with coarse status (no in-memory queue data).
 * Expects: storage migrations are applied before listing.
 */
export async function agentBackgroundList(storageOrConfig: Storage | Config): Promise<BackgroundAgentState[]> {
    const storage = storageResolve(storageOrConfig);
    const records = await storage.agents.findMany();
    const results: BackgroundAgentState[] = [];

    for (const record of records) {
        const descriptor = record.descriptor;
        if (descriptor.type === "user") {
            continue;
        }

        const name =
            descriptor.type === "subagent"
                ? (descriptor.name ?? "subagent")
                : descriptor.type === "app"
                  ? descriptor.name
                  : descriptor.type === "permanent"
                    ? (descriptor.name ?? "permanent")
                    : descriptor.type === "cron"
                      ? (descriptor.name ?? "cron task")
                      : descriptor.type === "memory-agent"
                        ? "memory-agent"
                        : descriptor.type === "memory-search"
                          ? (descriptor.name ?? "memory-search")
                          : descriptor.type === "subuser"
                            ? descriptor.name
                            : descriptor.tag;
        const parentAgentId =
            descriptor.type === "subagent" || descriptor.type === "app" || descriptor.type === "memory-search"
                ? (descriptor.parentAgentId ?? null)
                : null;

        results.push({
            agentId: record.id,
            name,
            parentAgentId,
            lifecycle: record.lifecycle,
            status: "idle",
            pending: 0,
            updatedAt: record.updatedAt
        });
    }

    return results;
}
