import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { AgentsRepository } from "./agentsRepository.js";
import type { AgentDbRecord } from "./databaseTypes.js";
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
            const record: AgentDbRecord = {
                id: "agent-1",
                version: 1,
                validFrom: 1,
                validTo: null,
                userId: ownerUser.id,
                type: "cron",
                descriptor: { type: "cron", id: "agent-1", name: "cron" },
                path: null,
                config: null,
                nextSubIndex: 0,
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                lifecycle: "active",
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
                type: "cron",
                descriptor: { type: "cron", id: "agent-cache", name: "cache" },
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
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
                    type,
                    descriptor,
                    active_session_id,
                    permissions,
                    tokens,
                    stats,
                    lifecycle,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
                )
                .run(
                    "agent-db",
                    1,
                    1,
                    null,
                    ownerUser.id,
                    "cron",
                    JSON.stringify({ type: "cron", id: "agent-db", name: "db" }),
                    null,
                    JSON.stringify(permissions),
                    null,
                    "{}",
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
                type: "cron",
                descriptor: { type: "cron", id: "agent-owner", name: "owner" },
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create({
                id: "agent-other",
                userId: otherUser.id,
                type: "cron",
                descriptor: { type: "cron", id: "agent-other", name: "other" },
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
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
