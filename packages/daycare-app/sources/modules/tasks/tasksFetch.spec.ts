import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tasksFetch } from "./tasksFetch";
import type { TaskListAllResult } from "./tasksTypes";

const BASE_URL = "http://localhost:7332";
const TOKEN = "test-token";

const sampleResult: TaskListAllResult = {
    tasks: [
        {
            id: "t1",
            title: "Daily Report",
            description: null,
            createdAt: 1000,
            updatedAt: 2000,
            lastExecutedAt: 3000
        }
    ],
    triggers: {
        cron: [
            {
                id: "c1",
                taskId: "t1",
                schedule: "0 9 * * *",
                timezone: "UTC",
                agentId: null,
                enabled: true,
                lastExecutedAt: 3000
            }
        ],
        webhook: []
    }
};

describe("tasksFetch", () => {
    beforeEach(() => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() =>
                Promise.resolve({
                    json: () =>
                        Promise.resolve({ ok: true, tasks: sampleResult.tasks, triggers: sampleResult.triggers })
                })
            )
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns tasks and triggers on success", async () => {
        const result = await tasksFetch(BASE_URL, TOKEN);
        expect(result).toEqual(sampleResult);
        expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/tasks`, {
            headers: { authorization: `Bearer ${TOKEN}` }
        });
    });

    it("throws on error response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() =>
                Promise.resolve({
                    json: () => Promise.resolve({ ok: false, error: "Unauthorized" })
                })
            )
        );
        await expect(tasksFetch(BASE_URL, TOKEN)).rejects.toThrow("Unauthorized");
    });

    it("throws generic message when error field is missing", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() =>
                Promise.resolve({
                    json: () => Promise.resolve({ ok: false })
                })
            )
        );
        await expect(tasksFetch(BASE_URL, TOKEN)).rejects.toThrow("Failed to fetch tasks");
    });

    it("returns empty arrays when fields are undefined", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() =>
                Promise.resolve({
                    json: () => Promise.resolve({ ok: true })
                })
            )
        );
        const result = await tasksFetch(BASE_URL, TOKEN);
        expect(result).toEqual({ tasks: [], triggers: { cron: [], webhook: [] } });
    });
});
