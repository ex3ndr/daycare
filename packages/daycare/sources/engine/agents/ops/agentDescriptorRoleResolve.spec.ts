import { describe, expect, it } from "vitest";
import { agentDescriptorRoleResolve } from "./agentDescriptorRoleResolve.js";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";

describe("agentDescriptorRoleResolve", () => {
    it("maps user descriptor to 'user'", () => {
        const d: AgentDescriptor = { type: "user", connector: "telegram", userId: "u1", channelId: "c1" };
        expect(agentDescriptorRoleResolve(d)).toBe("user");
    });

    it("maps swarm descriptor to 'user'", () => {
        const d: AgentDescriptor = {
            type: "swarm",
            id: "swarm-1"
        };
        expect(agentDescriptorRoleResolve(d)).toBe("user");
    });

    it("maps permanent descriptor to 'user'", () => {
        const d: AgentDescriptor = {
            type: "permanent",
            id: "p1",
            name: "Agent",
            description: "desc",
            systemPrompt: "sp"
        };
        expect(agentDescriptorRoleResolve(d)).toBe("user");
    });

    it("maps memory-agent descriptor to 'memory'", () => {
        const d: AgentDescriptor = { type: "memory-agent", id: "m1" };
        expect(agentDescriptorRoleResolve(d)).toBe("memory");
    });

    it("maps memory-search descriptor to 'memorySearch'", () => {
        const d: AgentDescriptor = { type: "memory-search", id: "ms1", parentAgentId: "p1", name: "search" };
        expect(agentDescriptorRoleResolve(d)).toBe("memorySearch");
    });

    it("maps subagent descriptor to 'subagent'", () => {
        const d: AgentDescriptor = { type: "subagent", id: "s1", parentAgentId: "p1", name: "worker" };
        expect(agentDescriptorRoleResolve(d)).toBe("subagent");
    });

    it("returns null for system descriptor", () => {
        const d: AgentDescriptor = { type: "system", tag: "status" };
        expect(agentDescriptorRoleResolve(d)).toBeNull();
    });

    it("returns null for cron descriptor", () => {
        const d: AgentDescriptor = { type: "cron", id: "c1" };
        expect(agentDescriptorRoleResolve(d)).toBeNull();
    });

    it("maps task descriptor to 'task'", () => {
        const d: AgentDescriptor = { type: "task", id: "task-1" };
        expect(agentDescriptorRoleResolve(d)).toBe("task");
    });
});
