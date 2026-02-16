import type { AgentDescriptor } from "./agentDescriptorTypes.js";
import { systemAgentPromptResolve } from "../system/systemAgentPromptResolve.js";

export type AgentPromptResolved = {
  agentPrompt: string;
  replaceSystemPrompt: boolean;
};

/**
 * Resolves prompt overrides for a descriptor before building the final system prompt.
 * Expects: descriptor is a validated agent descriptor.
 */
export async function agentPromptResolve(
  descriptor: AgentDescriptor
): Promise<AgentPromptResolved> {
  if (descriptor.type === "permanent" || descriptor.type === "app") {
    return {
      agentPrompt: descriptor.systemPrompt.trim(),
      replaceSystemPrompt: false
    };
  }
  if (descriptor.type !== "system") {
    return {
      agentPrompt: "",
      replaceSystemPrompt: false
    };
  }

  const resolved = await systemAgentPromptResolve(descriptor.tag);
  if (!resolved) {
    throw new Error(`Unknown system agent tag: ${descriptor.tag}`);
  }
  return {
    agentPrompt: resolved.systemPrompt,
    replaceSystemPrompt: resolved.replaceSystemPrompt
  };
}
