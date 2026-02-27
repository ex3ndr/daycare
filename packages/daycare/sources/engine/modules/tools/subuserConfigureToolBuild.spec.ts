import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import type { Storage } from "../../../storage/storage.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { UserHome } from "../../users/userHome.js";
import { subuserConfigureToolBuild } from "./subuserConfigureToolBuild.js";
import { subuserCreateToolBuild } from "./subuserCreateToolBuild.js";

const configureToolCall = { id: "tool-2", name: "subuser_configure" };
const createToolCall = { id: "tool-1", name: "subuser_create" };

describe("subuserConfigureToolBuild", () => {
    it("updates the gateway agent system prompt", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-subuser-configure-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const storage = await storageOpenTest();
            const owner = await storage.users.findOwner();
            const ownerUserId = owner!.id;
            const updateAgentDescriptor = vi.fn();
            const context = contextBuild(ownerUserId, {
                config: { current: config },
                storage,
                updateAgentDescriptor
            });

            // First create a subuser
            const createTool = subuserCreateToolBuild();
            const createResult = await createTool.execute(
                { name: "my-app", systemPrompt: "Initial prompt." },
                context,
                createToolCall
            );
            const createTyped = createResult.typedResult as { subuserId: string; gatewayAgentId: string };
            const subuserId = createTyped.subuserId;
            const gatewayAgentId = createTyped.gatewayAgentId;

            // Now configure it
            const configureTool = subuserConfigureToolBuild();
            const configureResult = await configureTool.execute(
                { subuserId, systemPrompt: "Updated prompt." },
                context,
                configureToolCall
            );

            const configTyped = configureResult.typedResult as { subuserId: string; gatewayAgentId: string };
            expect(configTyped.subuserId).toBe(subuserId);
            expect(configTyped.gatewayAgentId).toBe(gatewayAgentId);

            // Verify descriptor was updated in storage
            const agent = await storage.agents.findById(gatewayAgentId);
            expect(agent!.descriptor.type).toBe("subuser");
            if (agent!.descriptor.type === "subuser") {
                expect(agent!.descriptor.systemPrompt).toBe("Updated prompt.");
            }

            // Verify in-memory update was called
            expect(updateAgentDescriptor).toHaveBeenCalled();

            storage.db.close();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("rejects non-owner callers", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-subuser-configure-reject-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const storage = await storageOpenTest();
            await storage.users.create({ id: "regular-user" });

            const tool = subuserConfigureToolBuild();
            const context = contextBuild("regular-user", {
                config: { current: config },
                storage,
                updateAgentDescriptor: vi.fn()
            });

            await expect(
                tool.execute({ subuserId: "some-id", systemPrompt: "prompt" }, context, configureToolCall)
            ).rejects.toThrow("Only the owner user can configure subusers.");

            storage.db.close();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

function contextBuild(
    userId: string,
    agentSystem: {
        config: { current: ReturnType<typeof configResolve> };
        storage: Storage;
        updateAgentDescriptor: (agentId: string, descriptor: unknown) => void;
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
