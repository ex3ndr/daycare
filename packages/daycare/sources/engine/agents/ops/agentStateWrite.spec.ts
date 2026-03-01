import { describe, expect, it } from "vitest";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { permissionBuildUser } from "../../permissions/permissionBuildUser.js";
import { UserHome } from "../../users/userHome.js";
import { contextForAgent } from "../context.js";
import { agentStateWrite } from "./agentStateWrite.js";
import { agentWrite } from "./agentWrite.js";

describe("agentStateWrite", () => {
    it("emits agent lifecycle observations when lifecycle changes", async () => {
        const storage = await storageOpenTest();
        try {
            const userId = "user-lifecycle";
            const agentId = "agent-lifecycle";
            await storage.users.create({ id: userId, nametag: "lifecycle-user" });
            const permissions = permissionBuildUser(new UserHome("/tmp/daycare-agent-state", userId));
            const ctx = contextForAgent({ userId, agentId });
            const now = Date.now();

            await agentWrite(
                storage,
                ctx,
                "/user-lifecycle/cron/cron",
                {
                    kind: "cron",
                    modelRole: "user",
                    connectorName: null,
                    parentAgentId: null,
                    foreground: false,
                    name: "cron",
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null
                },
                permissions
            );
            await agentStateWrite(storage, ctx, {
                context: { messages: [] },
                activeSessionId: undefined,
                inferenceSessionId: undefined,
                permissions,
                tokens: null,
                stats: {},
                createdAt: now,
                updatedAt: now + 1,
                state: "sleeping"
            });

            const observations = await storage.observationLog.findMany({ userId, agentId });
            expect(observations.map((entry) => entry.type)).toEqual(expect.arrayContaining(["agent:lifecycle"]));
            const lifecycleEntry = observations.find((entry) => entry.type === "agent:lifecycle");
            expect(lifecycleEntry?.data).toEqual({
                agentId,
                userId,
                lifecycle: "sleeping",
                label: "cron"
            });
        } finally {
            storage.connection.close();
        }
    });
});
