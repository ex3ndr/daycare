import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import { configResolve } from "../config/configResolve.js";
import { rlmSnapshotSave } from "../engine/modules/rlm/rlmSnapshotSave.js";
import { rlmSnapshotLoad } from "../engine/modules/rlm/rlmSnapshotLoad.js";
import { permissionBuildUser } from "../engine/permissions/permissionBuildUser.js";
import { UserHome } from "../engine/users/userHome.js";
import { cuid2Is } from "../utils/cuid2Is.js";
import { Storage } from "./storage.js";

describe("Storage", () => {
    it("opens with migrations and closes connection", () => {
        const storage = Storage.open(":memory:");
        const tables = storage.db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC")
            .all() as Array<{ name?: string }>;
        expect(tables.some((entry) => entry.name === "agents")).toBe(true);
        expect(tables.some((entry) => entry.name === "users")).toBe(true);
        storage.close();

        expect(() => storage.db.prepare("SELECT 1").get()).toThrow();
    });

    it("resolves user by connector key under concurrent requests", async () => {
        const storage = Storage.open(":memory:");
        try {
            const results = await Promise.all(
                Array.from({ length: 12 }).map(() => storage.resolveUserByConnectorKey("telegram:alice"))
            );
            const firstId = results[0]?.id;
            expect(firstId).toBeTruthy();
            expect(new Set(results.map((entry) => entry.id))).toEqual(new Set([firstId]));

            const users = await storage.users.findMany();
            expect(users).toHaveLength(2);
            const resolved = users.find((entry) => entry.id === firstId);
            expect(resolved?.connectorKeys.map((entry) => entry.connectorKey)).toEqual(["telegram:alice"]);
            expect(resolved?.nametag).toBeTruthy();
        } finally {
            storage.close();
        }
    });

    it("creates agent and session atomically", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-storage-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const storage = Storage.open(config.dbPath);
            try {
                const user = await storage.createUser({});
                const agentId = createId();
                const createdAt = Date.now();
                const permissions = permissionBuildUser(new UserHome(config.usersDir, user.id));
                const result = await storage.createAgentWithSession({
                    record: {
                        id: agentId,
                        userId: user.id,
                        type: "cron",
                        descriptor: { type: "cron", id: agentId, name: "sync" },
                        activeSessionId: null,
                        permissions,
                        tokens: null,
                        stats: {},
                        lifecycle: "active",
                        createdAt,
                        updatedAt: createdAt
                    },
                    session: {
                        inferenceSessionId: "infer-1",
                        createdAt
                    }
                });

                expect(result.sessionId).toBeTruthy();
                expect(result.agent.activeSessionId).toBe(result.sessionId);
                const persistedAgent = await storage.agents.findById(agentId);
                expect(persistedAgent?.activeSessionId).toBe(result.sessionId);
                const persistedSession = await storage.sessions.findById(result.sessionId);
                expect(persistedSession?.inferenceSessionId).toBe("infer-1");
            } finally {
                storage.close();
            }
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("appendHistory creates session when missing and throws for unknown agent", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-storage-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const storage = Storage.open(config.dbPath);
            try {
                const user = await storage.createUser({});
                const agentId = createId();
                const permissions = permissionBuildUser(new UserHome(config.usersDir, user.id));
                await storage.agents.create({
                    id: agentId,
                    userId: user.id,
                    type: "cron",
                    descriptor: { type: "cron", id: agentId, name: "sync" },
                    activeSessionId: null,
                    permissions,
                    tokens: null,
                    stats: {},
                    lifecycle: "active",
                    createdAt: 1,
                    updatedAt: 1
                });

                await storage.appendHistory(agentId, { type: "note", at: 10, text: "hello" });
                const persistedAgent = await storage.agents.findById(agentId);
                expect(persistedAgent?.activeSessionId).toBeTruthy();
                const records = await storage.history.findBySessionId(persistedAgent?.activeSessionId ?? "");
                expect(records).toEqual([{ type: "note", at: 10, text: "hello" }]);

                await expect(
                    storage.appendHistory("missing-agent", { type: "note", at: 11, text: "x" })
                ).rejects.toThrow("Agent not found for history append");
            } finally {
                storage.close();
            }
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("stores rlm snapshots via rlm helpers and keeps snapshot id in history", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-storage-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const storage = Storage.open(config.dbPath);
            try {
                const user = await storage.createUser({});
                const agentId = createId();
                const permissions = permissionBuildUser(new UserHome(config.usersDir, user.id));
                await storage.agents.create({
                    id: agentId,
                    userId: user.id,
                    type: "cron",
                    descriptor: { type: "cron", id: agentId, name: "sync" },
                    activeSessionId: null,
                    permissions,
                    tokens: null,
                    stats: {},
                    lifecycle: "active",
                    createdAt: 1,
                    updatedAt: 1
                });

                const snapshotDump = Buffer.from([1, 2, 3]);
                const sessionId = await storage.sessions.create({
                    agentId,
                    createdAt: 10
                });
                await storage.agents.update(agentId, {
                    activeSessionId: sessionId,
                    updatedAt: 10
                });
                const snapshotId = await rlmSnapshotSave({
                    config,
                    agentId,
                    sessionId,
                    snapshotDump: snapshotDump.toString("base64")
                });
                await storage.appendHistory(agentId, {
                    type: "rlm_tool_call",
                    at: 10,
                    toolCallId: "tool-call-1",
                    snapshotId,
                    printOutput: [],
                    toolCallCount: 0,
                    toolName: "echo",
                    toolArgs: { text: "x" }
                });

                const persistedAgent = await storage.agents.findById(agentId);
                expect(persistedAgent?.activeSessionId).toBeTruthy();
                const persistedSessionId = persistedAgent?.activeSessionId ?? "";
                const records = await storage.history.findBySessionId(persistedSessionId);
                expect(records).toHaveLength(1);
                const record = records[0];
                expect(record?.type).toBe("rlm_tool_call");
                if (!record || record.type !== "rlm_tool_call") {
                    throw new Error("Expected rlm_tool_call history record.");
                }
                expect(cuid2Is(record.snapshotId)).toBe(true);
                const loaded = await rlmSnapshotLoad({
                    config,
                    agentId,
                    sessionId: persistedSessionId,
                    snapshotId: record.snapshotId
                });
                expect(loaded).toEqual(snapshotDump);
            } finally {
                storage.close();
            }
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
