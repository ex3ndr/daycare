import type { AgentDescriptor } from "./agentDescriptorTypes.js";

/**
 * Builds a short human-friendly label for an agent descriptor.
 * Expects: descriptor is valid.
 */
export function agentDescriptorLabel(descriptor: AgentDescriptor): string {
    if (descriptor.type === "subagent") {
        return descriptor.name ?? descriptor.type;
    }
    if (descriptor.type === "permanent") {
        if (descriptor.username) {
            return `${descriptor.name} (@${descriptor.username})`;
        }
        return descriptor.name;
    }
    if (descriptor.type === "cron") {
        return descriptor.name ?? "cron task";
    }
    if (descriptor.type === "task") {
        return `task ${descriptor.id}`;
    }
    if (descriptor.type === "system") {
        return descriptor.tag;
    }
    if (descriptor.type === "memory-agent") {
        return "memory-agent";
    }
    if (descriptor.type === "memory-search") {
        return descriptor.name;
    }
    if (descriptor.type === "swarm") {
        return `swarm ${descriptor.id}`;
    }
    return "user";
}
