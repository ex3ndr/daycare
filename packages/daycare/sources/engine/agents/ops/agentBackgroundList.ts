import type { Config } from "@/types";
import { agentDbList } from "../../../storage/agentDbList.js";
import type { BackgroundAgentState } from "./agentTypes.js";

/**
 * Lists persisted background agents with coarse status (no in-memory queue data).
 * Expects: storage migrations are applied before listing.
 */
export async function agentBackgroundList(config: Config): Promise<BackgroundAgentState[]> {
    const records = await agentDbList(config);
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
                      : descriptor.tag;
        const parentAgentId =
            descriptor.type === "subagent" || descriptor.type === "app" ? (descriptor.parentAgentId ?? null) : null;

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
