import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import type { Storage } from "../../../storage/storage.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { UserHome } from "../../users/userHome.js";
import { subuserCreateToolBuild } from "./subuserCreateToolBuild.js";
import { subuserListToolBuild } from "./subuserListToolBuild.js";

const listToolCall = { id: "tool-2", name: "subuser_list" };
const createToolCall = { id: "tool-1", name: "subuser_create" };

describe("subuserListToolBuild", () => {
    it("lists created subusers", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-subuser-list-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const storage = storageOpenTest();
            const owner = await storage.users.findOwner();
            const ownerUserId = owner!.id;
            const context = contextBuild(ownerUserId, {
                config: { current: config },
                storage
            });

            // Create two subusers
            const createTool = subuserCreateToolBuild();
            await createTool.execute({ name: "app-one", systemPrompt: "Prompt 1." }, context, createToolCall);
            await createTool.execute({ name: "app-two", systemPrompt: "Prompt 2." }, context, createToolCall);

            // List them
            const listTool = subuserListToolBuild();
            const result = await listTool.execute({}, context, listToolCall);

            expect(result.typedResult.count).toBe(2);
            expect(result.typedResult.summary).toContain("app-one");
            expect(result.typedResult.summary).toContain("app-two");

            storage.db.close();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("returns empty list when no subusers", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-subuser-list-empty-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const storage = storageOpenTest();
            const owner = await storage.users.findOwner();
            const ownerUserId = owner!.id;
            const context = contextBuild(ownerUserId, {
                config: { current: config },
                storage
            });

            const listTool = subuserListToolBuild();
            const result = await listTool.execute({}, context, listToolCall);

            expect(result.typedResult.count).toBe(0);
            expect(result.typedResult.summary).toContain("No subusers");

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
