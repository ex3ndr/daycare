import type { Config } from "@/types";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";
import { agentDbRead } from "../../../storage/agentDbRead.js";
import { agentDbWrite } from "../../../storage/agentDbWrite.js";

/**
 * Writes an agent descriptor into SQLite storage.
 * Expects: descriptor has been validated.
 */
export async function agentDescriptorWrite(
  config: Config,
  agentId: string,
  descriptor: AgentDescriptor
): Promise<void> {
  const existing = await agentDbRead(config, agentId);
  const now = Date.now();
  await agentDbWrite(config, {
    id: agentId,
    type: descriptor.type,
    descriptor,
    activeSessionId: existing?.activeSessionId ?? null,
    permissions: existing?.permissions ?? config.defaultPermissions,
    tokens: existing?.tokens ?? null,
    stats: existing?.stats ?? {},
    lifecycle: existing?.lifecycle ?? "active",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });
}
