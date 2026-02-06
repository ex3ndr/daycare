import type { AgentDescriptor } from "./agentDescriptorTypes.js";

/**
 * Builds a short human-friendly label for an agent descriptor.
 * Expects: descriptor is valid.
 */
export function agentDescriptorLabel(descriptor: AgentDescriptor): string {
  if (descriptor.type === "subagent" || descriptor.type === "permanent") {
    return descriptor.name ?? descriptor.type;
  }
  if (descriptor.type === "cron") {
    return `cron:${descriptor.id}`;
  }
  if (descriptor.type === "heartbeat") {
    return "heartbeat";
  }
  return "user";
}
