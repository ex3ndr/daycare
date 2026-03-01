import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { SessionPermissions, ToolExecutionContext } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import type { Storage } from "../../../storage/storage.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { contextForAgent } from "../../agents/context.js";
import { agentPermanentList } from "../../agents/ops/agentPermanentList.js";
import { agentStateRead } from "../../agents/ops/agentStateRead.js";
import { UserHome } from "../../users/userHome.js";
import { permanentAgentToolBuild } from "./permanentAgentToolBuild.js";

const toolCall = { id: "tool-1", name: "create_permanent_agent" };

describe("permanentAgentToolBuild", () => {
    it("creates a permanent agent with user baseline permissions", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-permanent-tool-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir }
                },
                path.join(dir, "settings.json")
            );
            const storage = await storageOpenTest();
            const updateAgentConfig = vi.fn();
            const updateAgentPermissions = vi.fn();
            const context = contextBuild({
                config: { current: config },
                storage,
                updateAgentConfig,
                updateAgentPermissions
            });
            const tool = permanentAgentToolBuild();

            await tool.execute(
                {
                    name: "ops",
                    description: "Ops automation",
                    systemPrompt: "Keep things running"
                },
                context,
                toolCall
            );

            const agents = await agentPermanentList(storage);
            const created = agents.find((entry) => entry.name === "ops") ?? null;
            expect(created).not.toBeNull();
            const state = await agentStateRead(
                storage,
                contextForAgent({ userId: "creator-user", agentId: created!.agentId })
            );
            expect(state?.permissions.writeDirs).toContain(
                path.resolve(path.join(dir, "users", "creator-user", "home"))
            );
            expect(updateAgentConfig).toHaveBeenCalledTimes(1);
            expect(updateAgentPermissions).toHaveBeenCalledTimes(1);
            storage.connection.close();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("stores permanent agent fields from tool input", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-permanent-tool-username-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir }
                },
                path.join(dir, "settings.json")
            );
            const storage = await storageOpenTest();
            const tool = permanentAgentToolBuild();
            const context = contextBuild({
                config: { current: config },
                storage,
                updateAgentConfig: vi.fn(),
                updateAgentPermissions: vi.fn()
            });

            await tool.execute(
                {
                    name: "ops",
                    description: "Operations agent",
                    systemPrompt: "Run operations tasks"
                },
                context,
                toolCall
            );

            const agents = await agentPermanentList(storage);
            const created = agents.find((entry) => entry.name === "ops") ?? null;
            expect(created?.description).toBe("Operations agent");
            expect(created?.systemPrompt).toBe("Run operations tasks");
            storage.connection.close();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("throws a clear error when context userId is missing", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-permanent-tool-missing-user-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir }
                },
                path.join(dir, "settings.json")
            );
            const storage = await storageOpenTest();
            const tool = permanentAgentToolBuild();
            const context = {
                ...contextBuild({
                    config: { current: config },
                    storage,
                    updateAgentConfig: vi.fn(),
                    updateAgentPermissions: vi.fn()
                }),
                ctx: null as unknown as ToolExecutionContext["ctx"]
            };

            await expect(
                tool.execute(
                    {
                        name: "ops",
                        description: "Operations agent",
                        systemPrompt: "Run operations tasks"
                    },
                    context,
                    toolCall
                )
            ).rejects.toThrow("Tool context userId is required.");
            storage.connection.close();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

function contextBuild(agentSystem: {
    config: { current: ReturnType<typeof configResolve> };
    storage: Storage;
    updateAgentConfig: (agentId: string, config: unknown) => void;
    updateAgentPermissions: (agentId: string, nextPermissions: SessionPermissions, updatedAt: number) => void;
    userHomeForUserId?: (userId: string) => UserHome;
}): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "creator-agent" } as unknown as ToolExecutionContext["agent"],
        ctx: {
            agentId: "creator-agent",
            userId: "creator-user"
        } as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: {
            ...agentSystem,
            userHomeForUserId:
                agentSystem.userHomeForUserId ??
                ((userId: string) => new UserHome(agentSystem.config.current.usersDir, userId))
        } as unknown as ToolExecutionContext["agentSystem"]
    };
}
