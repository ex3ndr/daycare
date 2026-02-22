import type { Tool } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import type { ToolResolverApi } from "../toolResolver.js";
import { rlmToolsForContextResolve } from "./rlmToolsForContextResolve.js";

describe("rlmToolsForContextResolve", () => {
    it("uses contextual tool listing when ctx and descriptor are present", () => {
        const listTools = vi.fn(() => [toolBuild("global_only")]);
        const listToolsForAgent = vi.fn(() => [toolBuild("memory_node_read"), toolBuild("memory_node_write")]);
        const resolver = resolverBuild({ listTools, listToolsForAgent });
        const descriptor = descriptorBuild();
        const context = contextBuild({
            ctx: { userId: "u1", agentId: "a1" },
            agent: agentBuild(descriptor)
        });

        const resolved = rlmToolsForContextResolve(resolver, context);

        expect(resolved.map((tool) => tool.name)).toEqual(["memory_node_read", "memory_node_write"]);
        expect(listToolsForAgent).toHaveBeenCalledWith({ userId: "u1", agentId: "a1", descriptor });
        expect(listTools).not.toHaveBeenCalled();
    });

    it("falls back to global tool listing when execution context is incomplete", () => {
        const listTools = vi.fn(() => [toolBuild("global_a"), toolBuild("global_b")]);
        const listToolsForAgent = vi.fn(() => [toolBuild("memory_node_read")]);
        const resolver = resolverBuild({ listTools, listToolsForAgent });
        const context = contextBuild({});

        const resolved = rlmToolsForContextResolve(resolver, context);

        expect(resolved.map((tool) => tool.name)).toEqual(["global_a", "global_b"]);
        expect(listTools).toHaveBeenCalledTimes(1);
        expect(listToolsForAgent).not.toHaveBeenCalled();
    });

    it("applies allowed tool filtering to contextual listings", () => {
        const listTools = vi.fn(() => [toolBuild("global_only")]);
        const listToolsForAgent = vi.fn(() => [
            toolBuild("memory_node_read"),
            toolBuild("memory_node_write"),
            toolBuild("search_web")
        ]);
        const resolver = resolverBuild({ listTools, listToolsForAgent });
        const context = contextBuild({
            ctx: { userId: "u1", agentId: "a1" },
            agent: agentBuild(descriptorBuild()),
            allowedToolNames: new Set(["memory_node_read", "memory_node_write", "run_python", "skip"])
        });

        const resolved = rlmToolsForContextResolve(resolver, context);

        expect(resolved.map((tool) => tool.name)).toEqual(["memory_node_read", "memory_node_write"]);
    });
});

function toolBuild(name: string): Tool {
    return {
        name,
        description: `${name} description`,
        parameters: {}
    } as unknown as Tool;
}

function descriptorBuild(): ToolExecutionContext["agent"]["descriptor"] {
    return {
        type: "memory-agent",
        parentAgentId: "parent-agent"
    } as unknown as ToolExecutionContext["agent"]["descriptor"];
}

function agentBuild(descriptor: ToolExecutionContext["agent"]["descriptor"]): ToolExecutionContext["agent"] {
    return {
        descriptor
    } as unknown as ToolExecutionContext["agent"];
}

function contextBuild(
    overrides: Partial<Pick<ToolExecutionContext, "ctx" | "agent" | "allowedToolNames">>
): Pick<ToolExecutionContext, "ctx" | "agent" | "allowedToolNames"> {
    return {
        ctx: overrides.ctx ?? (null as unknown as ToolExecutionContext["ctx"]),
        agent: overrides.agent ?? (null as unknown as ToolExecutionContext["agent"]),
        allowedToolNames: overrides.allowedToolNames
    };
}

function resolverBuild(functions: {
    listTools: ToolResolverApi["listTools"];
    listToolsForAgent: ToolResolverApi["listToolsForAgent"];
}): ToolResolverApi {
    return {
        listTools: functions.listTools,
        listToolsForAgent: functions.listToolsForAgent,
        execute: vi.fn()
    };
}
