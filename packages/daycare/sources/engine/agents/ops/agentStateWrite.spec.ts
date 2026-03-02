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

    it("preserves persisted createdAt during state writes", async () => {
        const storage = await storageOpenTest();
        try {
            const userId = "user-created-at";
            const agentId = "agent-created-at";
            await storage.users.create({ id: userId, nametag: "created-at-user" });
            const permissions = permissionBuildUser(new UserHome("/tmp/daycare-agent-state", userId));
            const ctx = contextForAgent({ userId, agentId });

            await agentWrite(
                storage,
                ctx,
                "/user-created-at/cron/cron",
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

            const created = await storage.agents.findById(agentId);
            expect(created).toBeTruthy();
            const persistedCreatedAt = created?.createdAt ?? 0;
            const persistedUpdatedAt = created?.updatedAt ?? 0;
            expect(persistedCreatedAt).toBeGreaterThan(0);

            await agentStateWrite(storage, ctx, {
                context: { messages: [] },
                activeSessionId: undefined,
                inferenceSessionId: undefined,
                permissions,
                createdAt: persistedCreatedAt - 1000,
                updatedAt: persistedUpdatedAt + 1,
                state: "active"
            });

            const current = await storage.agents.findById(agentId);
            expect(current?.version).toBe(1);
            expect(current?.createdAt).toBe(persistedCreatedAt);

            const rows = (await storage.connection
                .prepare("SELECT version, valid_to, created_at FROM agents WHERE id = ? ORDER BY version ASC")
                .all(agentId)) as Array<{
                version: number;
                valid_to: number | null;
                created_at: number;
            }>;
            expect(rows).toHaveLength(1);
            expect(rows[0]?.version).toBe(1);
            expect(rows[0]?.valid_to).toBeNull();
            expect(rows[0]?.created_at).toBe(persistedCreatedAt);
        } finally {
            storage.connection.close();
        }
    });
});
