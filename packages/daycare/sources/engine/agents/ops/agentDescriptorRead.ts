import type { Config, Context } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";

/**
 * Loads an agent descriptor from SQLite storage.
 * Expects: migrations have been applied before reads.
 */
export async function agentDescriptorRead(
    storageOrConfig: Storage | Config,
    ctx: Context
): Promise<AgentDescriptor | null> {
    const storage = storageResolve(storageOrConfig);
    const record = await storage.agents.findById(ctx.agentId);
    return record?.descriptor ?? null;
}
