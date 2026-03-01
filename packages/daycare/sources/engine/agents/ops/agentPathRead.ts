import type { Config, Context } from "@/types";
import type { Storage } from "../../../storage/storage.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import type { AgentPath } from "./agentPathTypes.js";

/**
 * Loads an agent path identity from storage.
 * Expects: migrations have been applied before reads.
 */
export async function agentPathRead(storageOrConfig: Storage | Config, ctx: Context): Promise<AgentPath | null> {
    const storage = storageResolve(storageOrConfig);
    const record = await storage.agents.findById(ctx.agentId);
    return (record?.path ?? null) as AgentPath | null;
}
