import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import type { Storage } from "../../../storage/storage.js";
import { storageOpen } from "../../../storage/storageOpen.js";
import { contextForAgent } from "../../agents/context.js";
import { UserHome } from "../../users/userHome.js";
import { subuserCreateToolBuild } from "./subuserCreateToolBuild.js";

const toolCall = { id: "tool-1", name: "subuser_create" };

describe("subuserCreateToolBuild", () => {
    it("creates a subuser with gateway agent", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-subuser-create-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const storage = storageOpen(config.dbPath);

            // Bootstrap migration creates an owner; find it
            const owner = await storage.users.findOwner();
            const ownerUserId = owner!.id;

            const tool = subuserCreateToolBuild();
            const context = contextBuild(ownerUserId, {
                config: { current: config },
                storage
            });

            const result = await tool.execute(
                { name: "my-app", systemPrompt: "You are a helpful assistant." },
                context,
                toolCall
            );

            const typed = result.typedResult as { name: string; subuserId: string; gatewayAgentId: string };
            expect(typed.name).toBe("my-app");
            expect(typed.subuserId).toBeTruthy();
            expect(typed.gatewayAgentId).toBeTruthy();

            // Verify subuser was created with correct parent
            const subuser = await storage.users.findById(typed.subuserId);
            expect(subuser).not.toBeNull();
            expect(subuser!.parentUserId).toBe(ownerUserId);
            expect(subuser!.name).toBe("my-app");

            // Verify gateway agent was created
            const agent = await storage.agents.findById(typed.gatewayAgentId);
            expect(agent).not.toBeNull();
            expect(agent!.userId).toBe(typed.subuserId);
            expect(agent!.type).toBe("subuser");
            expect(agent!.descriptor.type).toBe("subuser");

            storage.db.close();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("rejects non-owner callers", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-subuser-create-reject-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const storage = storageOpen(config.dbPath);

            // Bootstrap creates owner; create a regular user
            await storage.users.create({ id: "regular-user" });

            const tool = subuserCreateToolBuild();
            const context = contextBuild("regular-user", {
                config: { current: config },
                storage
            });

            await expect(tool.execute({ name: "my-app", systemPrompt: "prompt" }, context, toolCall)).rejects.toThrow(
                "Only the owner user can create subusers."
            );

            storage.db.close();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("hides from subuser agents", () => {
        const tool = subuserCreateToolBuild();
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "u1", agentId: "a1" }),
                descriptor: { type: "subuser", id: "su1", name: "app", systemPrompt: "sp" }
            })
        ).toBe(false);
        expect(
            tool.visibleByDefault?.({
                ctx: contextForAgent({ userId: "u1", agentId: "a1" }),
                descriptor: { type: "user", connector: "telegram", userId: "u1", channelId: "c1" }
            })
        ).toBe(true);
    });
});

function contextBuild(
    userId: string,
    agentSystem: {
        config: { current: ReturnType<typeof configResolve> };
        storage: Storage;
    }
): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: { id: "caller-agent" } as unknown as ToolExecutionContext["agent"],
        ctx: { agentId: "caller-agent", userId } as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: {
            ...agentSystem,
            userHomeForUserId: (uid: string) => new UserHome(agentSystem.config.current.usersDir, uid)
        } as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}
