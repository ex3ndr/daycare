import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tasksFetch } from "./tasksFetch";
import type { TaskActiveSummary } from "./tasksTypes";

const BASE_URL = "http://localhost:7332";
const TOKEN = "test-token";

const sampleTask: TaskActiveSummary = {
    id: "t1",
    title: "Daily Report",
    description: null,
    createdAt: 1000,
    updatedAt: 2000,
    lastExecutedAt: 3000,
    triggers: {
        cron: [{ id: "c1", schedule: "0 9 * * *", timezone: "UTC", agentId: null, lastExecutedAt: 3000 }],
        webhook: []
    }
};

describe("tasksFetch", () => {
    beforeEach(() => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() =>
                Promise.resolve({
                    json: () => Promise.resolve({ ok: true, tasks: [sampleTask] })
                })
            )
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns tasks on success", async () => {
        const result = await tasksFetch(BASE_URL, TOKEN);
        expect(result).toEqual([sampleTask]);
        expect(fetch).toHaveBeenCalledWith(`${BASE_URL}/tasks/active`, {
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

    it("returns empty array when tasks field is undefined", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() =>
                Promise.resolve({
                    json: () => Promise.resolve({ ok: true })
                })
            )
        );
        const result = await tasksFetch(BASE_URL, TOKEN);
        expect(result).toEqual([]);
    });
});
