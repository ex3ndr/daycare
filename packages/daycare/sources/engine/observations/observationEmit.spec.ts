import { describe, expect, it } from "vitest";
import { ObservationLogRepository } from "../../storage/observationLogRepository.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { observationEmit } from "./observationEmit.js";

describe("observationEmit", () => {
    it("appends a record with auto-generated ID and timestamp", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            const before = Date.now();

            const record = await observationEmit(repo, {
                userId: "user-a",
                type: "task.created",
                source: "agent:a1",
                message: "Task created",
                details: "Full details",
                data: { taskId: "t1" },
                scopeIds: ["t1"]
            });

            expect(record.id).toBeTruthy();
            expect(record.createdAt).toBeGreaterThanOrEqual(before);
            expect(record.userId).toBe("user-a");
            expect(record.type).toBe("task.created");
            expect(record.source).toBe("agent:a1");
            expect(record.message).toBe("Task created");

            const found = await repo.findMany({ userId: "user-a", agentId: "test" });
            expect(found).toHaveLength(1);
            expect(found[0]!.id).toBe(record.id);
        } finally {
            storage.connection.close();
        }
    });

    it("defaults optional fields to null and empty array", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);

            const record = await observationEmit(repo, {
                userId: "user-a",
                type: "system.boot",
                source: "system:startup",
                message: "Booted"
            });

            expect(record.details).toBeNull();
            expect(record.data).toBeNull();
            expect(record.scopeIds).toEqual([]);

            const found = await repo.findMany({ userId: "user-a", agentId: "test" });
            expect(found).toHaveLength(1);
            expect(found[0]!.scopeIds).toEqual([]);
        } finally {
            storage.connection.close();
        }
    });
});
