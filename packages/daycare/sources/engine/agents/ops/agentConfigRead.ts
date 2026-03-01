import type { Config, Context } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentConfig } from "./agentConfigTypes.js";

/**
 * Loads an agent config blob from storage.
 * Expects: migrations have been applied before reads.
 */
export async function agentConfigRead(storageOrConfig: Storage | Config, ctx: Context): Promise<AgentConfig | null> {
    const storage = storageResolve(storageOrConfig);
    const record = await storage.agents.findById(ctx.agentId);
    return record?.config ?? null;
}
