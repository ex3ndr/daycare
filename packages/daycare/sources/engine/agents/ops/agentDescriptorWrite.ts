import { promises as fs } from "node:fs";
import path from "node:path";

import type { Config } from "@/types";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";
import { agentPathBuild } from "./agentPathBuild.js";
import { atomicWrite } from "../../../util/atomicWrite.js";

/**
 * Writes an agent descriptor to disk with an atomic rename.
 * Expects: descriptor has been validated.
 */
export async function agentDescriptorWrite(
  config: Config,
  agentId: string,
  descriptor: AgentDescriptor
): Promise<void> {
  const basePath = agentPathBuild(config, agentId);
  await fs.mkdir(basePath, { recursive: true });
  const filePath = path.join(basePath, "descriptor.json");
  const payload = `${JSON.stringify(descriptor, null, 2)}\n`;
  await atomicWrite(filePath, payload);
}
