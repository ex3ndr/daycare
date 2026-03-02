import { describe, expect, it } from "vitest";

import type { Storage } from "../../../storage/storage.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { userStateDetect } from "./userStateDetect.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

async function createStorage(): Promise<Storage> {
    return await storageOpenTest();
}

describe("userStateDetect", () => {
    it("returns new_user for non-existent user", async () => {
        const storage = await createStorage();
        try {
            const state = await userStateDetect(storage, "nonexistent");
            expect(state).toBe("new_user");
        } finally {
            storage.connection.close();
        }
    });

    it("returns new_user for user with no agents", async () => {
        const storage = await createStorage();
        try {
            const now = Date.now();
            await storage.createUser({ id: "u1", nametag: "alice", createdAt: now, updatedAt: now });

            const state = await userStateDetect(storage, "u1");
            expect(state).toBe("new_user");
        } finally {
            storage.connection.close();
        }
    });

    it("returns new_user for recent user with agent but no compaction", async () => {
        const storage = await createStorage();
        try {
            const now = Date.now();
            await storage.createUser({ id: "u1", nametag: "alice", createdAt: now - 1000, updatedAt: now });

            await storage.createAgentWithSession({
                record: {
                    id: "a1",
                    userId: "u1",
                    path: "/u1/test",
                    kind: "connector",
                    modelRole: "user",
                    connectorName: "test",
                    parentAgentId: null,
                    foreground: true,
                    name: null,
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null,
                    type: "user",
                    descriptor: { type: "user", connector: "test", userId: "u1", channelId: "ch1" },
                    activeSessionId: null,
                    permissions: { workingDir: "/tmp", writeDirs: [] },
                    lifecycle: "active",
                    createdAt: now - 1000,
                    updatedAt: now
                }
            });

            const state = await userStateDetect(storage, "u1");
            expect(state).toBe("new_user");
        } finally {
            storage.connection.close();
        }
    });

    it("returns active_user for old user with no compaction and recent activity", async () => {
        const storage = await createStorage();
        try {
            const now = Date.now();
            const oldCreatedAt = now - SEVEN_DAYS_MS - 1000;

            await storage.createUser({ id: "u1", nametag: "alice", createdAt: oldCreatedAt, updatedAt: now });

            await storage.createAgentWithSession({
                record: {
                    id: "a1",
                    userId: "u1",
                    path: "/u1/test",
                    kind: "connector",
                    modelRole: "user",
                    connectorName: "test",
                    parentAgentId: null,
                    foreground: true,
                    name: null,
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null,
                    type: "user",
                    descriptor: { type: "user", connector: "test", userId: "u1", channelId: "ch1" },
                    activeSessionId: null,
                    permissions: { workingDir: "/tmp", writeDirs: [] },
                    lifecycle: "active",
                    createdAt: oldCreatedAt,
                    updatedAt: now
                }
            });

            const state = await userStateDetect(storage, "u1");
            expect(state).toBe("active_user");
        } finally {
            storage.connection.close();
        }
    });

    it("returns returning_user when last activity was more than 3 days ago", async () => {
        const storage = await createStorage();
        try {
            const now = Date.now();
            const oldUpdatedAt = now - THREE_DAYS_MS - 1000;
            const oldCreatedAt = now - SEVEN_DAYS_MS - 1000;

            await storage.createUser({
                id: "u1",
                nametag: "alice",
                createdAt: oldCreatedAt,
                updatedAt: oldUpdatedAt
            });

            await storage.createAgentWithSession({
                record: {
                    id: "a1",
                    userId: "u1",
                    path: "/u1/test",
                    kind: "connector",
                    modelRole: "user",
                    connectorName: "test",
                    parentAgentId: null,
                    foreground: true,
                    name: null,
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null,
                    type: "user",
                    descriptor: { type: "user", connector: "test", userId: "u1", channelId: "ch1" },
                    activeSessionId: null,
                    permissions: { workingDir: "/tmp", writeDirs: [] },
                    lifecycle: "active",
                    createdAt: oldCreatedAt,
                    updatedAt: oldUpdatedAt
                }
            });

            const state = await userStateDetect(storage, "u1");
            expect(state).toBe("returning_user");
        } finally {
            storage.connection.close();
        }
    });

    it("returns active_user for user with compaction and recent activity", async () => {
        const storage = await createStorage();
        try {
            const now = Date.now();
            const recentCreatedAt = now - 1000;

            await storage.createUser({
                id: "u1",
                nametag: "alice",
                createdAt: recentCreatedAt,
                updatedAt: now
            });

            const { sessionId } = await storage.createAgentWithSession({
                record: {
                    id: "a1",
                    userId: "u1",
                    path: "/u1/test",
                    kind: "connector",
                    modelRole: "user",
                    connectorName: "test",
                    parentAgentId: null,
                    foreground: true,
                    name: null,
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null,
                    type: "user",
                    descriptor: { type: "user", connector: "test", userId: "u1", channelId: "ch1" },
                    activeSessionId: null,
                    permissions: { workingDir: "/tmp", writeDirs: [] },
                    lifecycle: "active",
                    createdAt: recentCreatedAt,
                    updatedAt: now
                }
            });

            // Simulate compaction by setting invalidatedAt
            await storage.sessions.invalidate(sessionId, 1);

            const state = await userStateDetect(storage, "u1");
            // Even though user is < 7 days old, compaction means they're not "new"
            expect(state).toBe("active_user");
        } finally {
            storage.connection.close();
        }
    });
});
