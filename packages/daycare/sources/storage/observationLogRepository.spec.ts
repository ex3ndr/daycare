import { describe, expect, it } from "vitest";
import type { Context } from "@/types";
import { ObservationLogRepository } from "./observationLogRepository.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("ObservationLogRepository", () => {
    it("appends and retrieves a record with scope IDs", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append({
                id: "obs-1",
                userId: "user-a",
                type: "task.updated",
                source: "agent:agent-1",
                message: "Task completed",
                details: "The task was marked as done by the agent.",
                data: { taskId: "t1", status: "done" },
                scopeIds: ["t1", "agent-1"],
                createdAt: 1000
            });

            const results = await repo.findMany(ctx("user-a"));
            expect(results).toHaveLength(1);
            const first = results[0]!;
            expect(first.id).toBe("obs-1");
            expect(first.message).toBe("Task completed");
            expect(first.details).toBe("The task was marked as done by the agent.");
            expect(first.data).toEqual({ taskId: "t1", status: "done" });
            expect(first.scopeIds).toEqual(expect.arrayContaining(["t1", "agent-1"]));
        } finally {
            storage.connection.close();
        }
    });

    it("appends a record with no scope IDs", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append({
                id: "obs-1",
                userId: "user-a",
                type: "system.boot",
                source: "system:startup",
                message: "System started",
                details: null,
                data: null,
                scopeIds: [],
                createdAt: 1000
            });

            const results = await repo.findMany(ctx("user-a"));
            expect(results).toHaveLength(1);
            const first = results[0]!;
            expect(first.scopeIds).toEqual([]);
            expect(first.details).toBeNull();
            expect(first.data).toBeNull();
        } finally {
            storage.connection.close();
        }
    });

    it("scopes queries by user", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append(makeObs("obs-1", "user-a", "task.created", 10));
            await repo.append(makeObs("obs-2", "user-b", "task.created", 20));
            await repo.append(makeObs("obs-3", "user-a", "task.updated", 30));

            const userA = await repo.findMany(ctx("user-a"));
            const userB = await repo.findMany(ctx("user-b"));

            expect(userA.map((r) => r.id)).toEqual(["obs-1", "obs-3"]);
            expect(userB.map((r) => r.id)).toEqual(["obs-2"]);
        } finally {
            storage.connection.close();
        }
    });

    it("filters by type", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append(makeObs("obs-1", "user-a", "task.created", 10));
            await repo.append(makeObs("obs-2", "user-a", "task.updated", 20));
            await repo.append(makeObs("obs-3", "user-a", "memory.extracted", 30));

            const results = await repo.findMany(ctx("user-a"), { type: "task.updated" });
            expect(results.map((r) => r.id)).toEqual(["obs-2"]);
        } finally {
            storage.connection.close();
        }
    });

    it("filters by source prefix", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append(makeObs("obs-1", "user-a", "e1", 10, "agent:a1"));
            await repo.append(makeObs("obs-2", "user-a", "e2", 20, "plugin:telegram"));
            await repo.append(makeObs("obs-3", "user-a", "e3", 30, "agent:a2"));

            const agents = await repo.findMany(ctx("user-a"), { source: "agent:" });
            expect(agents.map((r) => r.id)).toEqual(["obs-1", "obs-3"]);

            const plugins = await repo.findMany(ctx("user-a"), { source: "plugin:" });
            expect(plugins.map((r) => r.id)).toEqual(["obs-2"]);
        } finally {
            storage.connection.close();
        }
    });

    it("filters by scope IDs (any match)", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append({ ...makeObs("obs-1", "user-a", "e1", 10), scopeIds: ["t1", "a1"] });
            await repo.append({ ...makeObs("obs-2", "user-a", "e2", 20), scopeIds: ["t2"] });
            await repo.append({ ...makeObs("obs-3", "user-a", "e3", 30), scopeIds: ["t1", "t2"] });
            await repo.append({ ...makeObs("obs-4", "user-a", "e4", 40), scopeIds: [] });

            // Match any event with scope "t1"
            const byT1 = await repo.findMany(ctx("user-a"), { scopeIds: ["t1"] });
            expect(byT1.map((r) => r.id)).toEqual(["obs-1", "obs-3"]);

            // Match any event with scope "t1" OR "t2"
            const byT1OrT2 = await repo.findMany(ctx("user-a"), { scopeIds: ["t1", "t2"] });
            expect(byT1OrT2.map((r) => r.id)).toEqual(["obs-1", "obs-2", "obs-3"]);

            // Match non-existent scope
            const byNone = await repo.findMany(ctx("user-a"), { scopeIds: ["nope"] });
            expect(byNone).toEqual([]);
        } finally {
            storage.connection.close();
        }
    });

    it("filters by date range", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append(makeObs("obs-1", "user-a", "e1", 100));
            await repo.append(makeObs("obs-2", "user-a", "e2", 200));
            await repo.append(makeObs("obs-3", "user-a", "e3", 300));
            await repo.append(makeObs("obs-4", "user-a", "e4", 400));

            // afterDate inclusive, beforeDate exclusive
            const results = await repo.findMany(ctx("user-a"), { afterDate: 200, beforeDate: 400 });
            expect(results.map((r) => r.id)).toEqual(["obs-2", "obs-3"]);
        } finally {
            storage.connection.close();
        }
    });

    it("supports pagination with limit and offset", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            for (let i = 1; i <= 5; i++) {
                await repo.append(makeObs(`obs-${i}`, "user-a", "e", i * 10));
            }

            const page1 = await repo.findMany(ctx("user-a"), { limit: 2, offset: 0 });
            const page2 = await repo.findMany(ctx("user-a"), { limit: 2, offset: 2 });
            const page3 = await repo.findMany(ctx("user-a"), { limit: 2, offset: 4 });

            expect(page1.map((r) => r.id)).toEqual(["obs-1", "obs-2"]);
            expect(page2.map((r) => r.id)).toEqual(["obs-3", "obs-4"]);
            expect(page3.map((r) => r.id)).toEqual(["obs-5"]);
        } finally {
            storage.connection.close();
        }
    });

    it("findRecent returns most recent N in chronological order", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            for (let i = 1; i <= 10; i++) {
                await repo.append(makeObs(`obs-${i}`, "user-a", "e", i * 10));
            }

            const recent3 = await repo.findRecent(ctx("user-a"), { limit: 3 });
            // Should return most recent 3, but in chronological order
            expect(recent3.map((r) => r.id)).toEqual(["obs-8", "obs-9", "obs-10"]);
        } finally {
            storage.connection.close();
        }
    });

    it("findRecent respects type and source filters", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append(makeObs("obs-1", "user-a", "task.created", 10, "agent:a1"));
            await repo.append(makeObs("obs-2", "user-a", "task.updated", 20, "plugin:x"));
            await repo.append(makeObs("obs-3", "user-a", "task.created", 30, "agent:a2"));
            await repo.append(makeObs("obs-4", "user-a", "memory.extracted", 40, "agent:a1"));

            const recent = await repo.findRecent(ctx("user-a"), { type: "task.created", source: "agent:" });
            expect(recent.map((r) => r.id)).toEqual(["obs-1", "obs-3"]);
        } finally {
            storage.connection.close();
        }
    });

    it("findRecent with scope filter", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append({ ...makeObs("obs-1", "user-a", "e1", 10), scopeIds: ["t1"] });
            await repo.append({ ...makeObs("obs-2", "user-a", "e2", 20), scopeIds: ["t2"] });
            await repo.append({ ...makeObs("obs-3", "user-a", "e3", 30), scopeIds: ["t1"] });

            const recent = await repo.findRecent(ctx("user-a"), { scopeIds: ["t1"], limit: 10 });
            expect(recent.map((r) => r.id)).toEqual(["obs-1", "obs-3"]);
        } finally {
            storage.connection.close();
        }
    });

    it("combined filters work together", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append({ ...makeObs("obs-1", "user-a", "task.created", 100, "agent:a1"), scopeIds: ["t1"] });
            await repo.append({ ...makeObs("obs-2", "user-a", "task.created", 200, "agent:a1"), scopeIds: ["t2"] });
            await repo.append({ ...makeObs("obs-3", "user-a", "task.updated", 300, "agent:a1"), scopeIds: ["t1"] });
            await repo.append({ ...makeObs("obs-4", "user-a", "task.created", 400, "plugin:x"), scopeIds: ["t1"] });

            // type=task.created AND source=agent: AND scope=t1 AND afterDate=50 AND beforeDate=350
            const results = await repo.findMany(ctx("user-a"), {
                type: "task.created",
                source: "agent:",
                scopeIds: ["t1"],
                afterDate: 50,
                beforeDate: 350
            });
            expect(results.map((r) => r.id)).toEqual(["obs-1"]);
        } finally {
            storage.connection.close();
        }
    });
});

function ctx(userId: string): Context {
    return { agentId: "test-agent", userId };
}

function makeObs(
    id: string,
    userId: string,
    type: string,
    createdAt: number,
    source = "system:test"
): ObservationLogDbRecord {
    return {
        id,
        userId,
        type,
        source,
        message: `Event ${id}`,
        details: null,
        data: null,
        scopeIds: [],
        createdAt
    };
}

type ObservationLogDbRecord = {
    id: string;
    userId: string;
    type: string;
    source: string;
    message: string;
    details: string | null;
    data: unknown;
    scopeIds: string[];
    createdAt: number;
};
