import { describe, expect, it } from "vitest";
import type { Context } from "@/types";
import { ObservationLogRepository } from "../../storage/observationLogRepository.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { observationQueryToolBuild } from "./observationQueryToolBuild.js";

describe("observationQueryToolBuild", () => {
    it("returns tool definition with correct name and schema", () => {
        const repo = {} as ObservationLogRepository;
        const toolDef = observationQueryToolBuild(repo);
        expect(toolDef.tool.name).toBe("observation_query");
        expect(toolDef.tool.parameters).toBeDefined();
        expect(toolDef.returns.toLLMText).toBeTypeOf("function");
    });

    it("executes and returns short format by default", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append({
                id: "obs-1",
                userId: "user-a",
                type: "task.created",
                source: "agent:a1",
                message: "Task created",
                details: null,
                data: null,
                scopeIds: ["t1"],
                createdAt: 1000
            });

            const toolDef = observationQueryToolBuild(repo);
            const result = await toolDef.execute({}, makeToolContext("user-a"), makeToolCall());
            expect(result.typedResult.count).toBe(1);
            expect(result.typedResult.mode).toBe("short");
            expect(result.typedResult.summary).toContain("Task created");
        } finally {
            storage.connection.close();
        }
    });

    it("executes with full mode", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append({
                id: "obs-1",
                userId: "user-a",
                type: "task.created",
                source: "agent:a1",
                message: "Task created",
                details: "Full details here",
                data: { key: "value" },
                scopeIds: ["t1"],
                createdAt: 1000
            });

            const toolDef = observationQueryToolBuild(repo);
            const result = await toolDef.execute({ mode: "full" }, makeToolContext("user-a"), makeToolCall());
            expect(result.typedResult.summary).toContain("Full details here");
            expect(result.typedResult.summary).toContain("source=agent:a1");
        } finally {
            storage.connection.close();
        }
    });

    it("executes with json mode", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append({
                id: "obs-1",
                userId: "user-a",
                type: "e1",
                source: "system:test",
                message: "msg",
                details: null,
                data: { status: "ok" },
                scopeIds: [],
                createdAt: 1000
            });

            const toolDef = observationQueryToolBuild(repo);
            const result = await toolDef.execute({ mode: "json" }, makeToolContext("user-a"), makeToolCall());
            expect(JSON.parse(result.typedResult.summary as string)).toEqual({ status: "ok" });
        } finally {
            storage.connection.close();
        }
    });

    it("filters by scope IDs", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            await repo.append({
                id: "obs-1",
                userId: "user-a",
                type: "e1",
                source: "system:test",
                message: "With scope",
                details: null,
                data: null,
                scopeIds: ["t1"],
                createdAt: 1000
            });
            await repo.append({
                id: "obs-2",
                userId: "user-a",
                type: "e2",
                source: "system:test",
                message: "No matching scope",
                details: null,
                data: null,
                scopeIds: ["t2"],
                createdAt: 2000
            });

            const toolDef = observationQueryToolBuild(repo);
            const result = await toolDef.execute({ scopeIds: ["t1"] }, makeToolContext("user-a"), makeToolCall());
            expect(result.typedResult.count).toBe(1);
            expect(result.typedResult.summary).toContain("With scope");
        } finally {
            storage.connection.close();
        }
    });

    it("returns empty message when no results", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new ObservationLogRepository(storage.db);
            const toolDef = observationQueryToolBuild(repo);
            const result = await toolDef.execute({}, makeToolContext("user-a"), makeToolCall());
            expect(result.typedResult.count).toBe(0);
            expect(result.typedResult.summary).toBe("No observations found.");
        } finally {
            storage.connection.close();
        }
    });

    it("toLLMText returns summary", () => {
        const toolDef = observationQueryToolBuild({} as ObservationLogRepository);
        const text = toolDef.returns.toLLMText({
            summary: "test summary",
            count: 5,
            mode: "short"
        });
        expect(text).toBe("test summary");
    });
});

// biome-ignore lint/suspicious/noExplicitAny: test helper providing partial tool context
function makeToolContext(userId: string): any {
    return {
        ctx: { userId, agentId: "test-agent" } as Context
    };
}

function makeToolCall(): { id: string; name: string } {
    return { id: "call-1", name: "observation_query" };
}
