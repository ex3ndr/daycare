import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { AgentsRepository } from "./agentsRepository.js";
import { storageOpenTest } from "./storageOpenTest.js";

const permissions: SessionPermissions = {
    workingDir: "/workspace",
    writeDirs: ["/workspace"]
};

describe("AgentsRepository", () => {
    it("supports create, find and update", async () => {
        const storage = await storageOpenTest();
        try {
            const users = await storage.users.findMany();
            const ownerUser = users[0];
            if (!ownerUser) {
                throw new Error("Owner user missing");
            }
            const repo = new AgentsRepository(storage.db);
            const record = {
                id: "agent-1",
                version: 1,
                validFrom: 1,
                validTo: null,
                userId: ownerUser.id,
                path: `/${ownerUser.id}/cron/agent-1`,
                kind: "cron" as const,
                modelRole: null,
                connectorName: null,
                parentAgentId: null,
                foreground: false,
                name: "cron",
                description: null,
                systemPrompt: null,
                workspaceDir: null,
                nextSubIndex: 0,
                activeSessionId: null,
                permissions,
                lifecycle: "active" as const,
                createdAt: 1,
                updatedAt: 1
            };
            await repo.create(record);

            const byId = await repo.findById("agent-1");
            expect(byId).toEqual(record);

            await repo.update("agent-1", {
                lifecycle: "sleeping",
                updatedAt: 2
            });
            const updated = await repo.findById("agent-1");
            expect(updated?.lifecycle).toBe("sleeping");
            expect(updated?.updatedAt).toBe(2);

            const listed = await repo.findMany();
            expect(listed).toHaveLength(1);
            expect(listed[0]?.id).toBe("agent-1");
        } finally {
            storage.connection.close();
        }
    });

    it("updates runtime fields in place without advancing version", async () => {
        const storage = await storageOpenTest();
        try {
            const ownerUser = (await storage.users.findMany())[0];
            if (!ownerUser) {
                throw new Error("Owner user missing");
            }
            const repo = new AgentsRepository(storage.db);
            await repo.create({
                id: "agent-lifecycle-inplace",
                userId: ownerUser.id,
                path: `/${ownerUser.id}/cron/agent-lifecycle-inplace`,
                foreground: false,
                name: "lifecycle",
                description: null,
                systemPrompt: null,
                workspaceDir: null,
                type: "cron",
                descriptor: { type: "cron", id: "agent-lifecycle-inplace", name: "lifecycle" },
                activeSessionId: null,
                permissions,
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });

            await repo.update("agent-lifecycle-inplace", {
                lifecycle: "sleeping",
                nextSubIndex: 2,
                activeSessionId: "session-1",
                updatedAt: 2
            });

            const current = await repo.findById("agent-lifecycle-inplace");
            expect(current?.version).toBe(1);
            expect(current?.lifecycle).toBe("sleeping");
            expect(current?.nextSubIndex).toBe(2);
            expect(current?.activeSessionId).toBe("session-1");
            expect(current?.updatedAt).toBe(2);

            const rows = (await storage.connection
                .prepare(
                    "SELECT version, valid_to, lifecycle, next_sub_index, active_session_id FROM agents WHERE id = ? ORDER BY version ASC"
                )
                .all("agent-lifecycle-inplace")) as Array<{
                version: number;
                valid_to: number | null;
                lifecycle: string;
                next_sub_index: number;
                active_session_id: string | null;
            }>;
            expect(rows).toHaveLength(1);
            expect(rows[0]?.version).toBe(1);
            expect(rows[0]?.valid_to).toBeNull();
            expect(rows[0]?.lifecycle).toBe("sleeping");
            expect(rows[0]?.next_sub_index).toBe(2);
            expect(rows[0]?.active_session_id).toBe("session-1");
        } finally {
            storage.connection.close();
        }
    });

    it("returns cached agent on repeated read", async () => {
        const storage = await storageOpenTest();
        try {
            const ownerUser = (await storage.users.findMany())[0];
            if (!ownerUser) {
                throw new Error("Owner user missing");
            }
            const repo = new AgentsRepository(storage.db);
            await repo.create({
                id: "agent-cache",
                userId: ownerUser.id,
                path: `/${ownerUser.id}/cron/agent-cache`,
                foreground: false,
                name: "cache",
                description: null,
                systemPrompt: null,
                workspaceDir: null,
                type: "cron",
                descriptor: { type: "cron", id: "agent-cache", name: "cache" },
                activeSessionId: null,
                permissions,
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });

            const first = await repo.findById("agent-cache");
            expect(first?.id).toBe("agent-cache");

            storage.connection.prepare("DELETE FROM agents WHERE id = ?").run("agent-cache");
            const second = await repo.findById("agent-cache");
            expect(second?.id).toBe("agent-cache");
        } finally {
            storage.connection.close();
        }
    });

    it("loads from db on cache miss", async () => {
        const storage = await storageOpenTest();
        try {
            const ownerUser = (await storage.users.findMany())[0];
            if (!ownerUser) {
                throw new Error("Owner user missing");
            }
            const repo = new AgentsRepository(storage.db);
            storage.connection
                .prepare(
                    `
                  INSERT INTO agents (
                    id,
                    version,
                    valid_from,
                    valid_to,
                    user_id,
                    path,
                    foreground,
                    name,
                    description,
                    system_prompt,
                    workspace_dir,
                    next_sub_index,
                    active_session_id,
                    permissions,
                    lifecycle,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
                )
                .run(
                    "agent-db",
                    1,
                    1,
                    null,
                    ownerUser.id,
                    `/${ownerUser.id}/cron/agent-db`,
                    false,
                    "db",
                    null,
                    null,
                    null,
                    0,
                    null,
                    JSON.stringify(permissions),
                    "active",
                    1,
                    2
                );

            const loaded = await repo.findById("agent-db");
            expect(loaded?.id).toBe("agent-db");
            expect(loaded?.updatedAt).toBe(2);
        } finally {
            storage.connection.close();
        }
    });

    it("finds agents by user id", async () => {
        const storage = await storageOpenTest();
        try {
            const users = await storage.users.findMany();
            const ownerUser = users[0];
            if (!ownerUser) {
                throw new Error("Owner user missing");
            }
            const otherUser = await storage.users.create({ nametag: "other-user-42" });
            const repo = new AgentsRepository(storage.db);

            await repo.create({
                id: "agent-owner",
                userId: ownerUser.id,
                path: `/${ownerUser.id}/cron/agent-owner`,
                foreground: false,
                name: "owner",
                description: null,
                systemPrompt: null,
                workspaceDir: null,
                type: "cron",
                descriptor: { type: "cron", id: "agent-owner", name: "owner" },
                activeSessionId: null,
                permissions,
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create({
                id: "agent-other",
                userId: otherUser.id,
                path: `/${otherUser.id}/cron/agent-other`,
                foreground: false,
                name: "other",
                description: null,
                systemPrompt: null,
                workspaceDir: null,
                type: "cron",
                descriptor: { type: "cron", id: "agent-other", name: "other" },
                activeSessionId: null,
                permissions,
                lifecycle: "active",
                createdAt: 2,
                updatedAt: 2
            });

            const ownerAgents = await repo.findByUserId(ownerUser.id);
            expect(ownerAgents.map((agent) => agent.id)).toEqual(["agent-owner"]);

            const otherAgents = await repo.findByUserId(otherUser.id);
            expect(otherAgents.map((agent) => agent.id)).toEqual(["agent-other"]);
        } finally {
            storage.connection.close();
        }
    });
});
