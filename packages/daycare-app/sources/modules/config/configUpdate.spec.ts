import { afterEach, describe, expect, it, vi } from "vitest";
import { configUpdate } from "./configUpdate";

describe("configUpdate", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("writes configuration through the workspace-scoped profile route", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            json: async () => ({ ok: true })
        });
        vi.stubGlobal("fetch", fetchMock);

        await configUpdate("http://localhost:3000", "token-1", "workspace-a", {
            bootstrapStarted: true
        });

        expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/w/workspace-a/profile/update", {
            method: "POST",
            headers: {
                authorization: "Bearer token-1",
                "content-type": "application/json"
            },
            body: JSON.stringify({
                configuration: {
                    bootstrapStarted: true
                }
            })
        });
    });

    it("throws the API error when the update fails", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            json: async () => ({ ok: false, error: "Denied" })
        });
        vi.stubGlobal("fetch", fetchMock);

        await expect(configUpdate("http://localhost:3000", "token-1", "workspace-a", {})).rejects.toThrow("Denied");
    });
});
