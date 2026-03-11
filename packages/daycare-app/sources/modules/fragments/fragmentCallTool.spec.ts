import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fragmentCallTool } from "./fragmentCallTool";

describe("fragmentCallTool", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("sends POST request to correct endpoint", async () => {
        const mockResponse = { ok: true, result: { rows: [] } };
        vi.mocked(global.fetch).mockResolvedValueOnce({
            json: () => Promise.resolve(mockResponse)
        } as Response);

        await fragmentCallTool(
            "https://api.example.com",
            "test-token",
            null,
            "frag-123",
            "psql_query",
            { dbId: "db-1", sql: "SELECT 1" }
        );

        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.example.com/fragments/frag-123/call",
            expect.objectContaining({
                method: "POST",
                headers: {
                    authorization: "Bearer test-token",
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    tool: "psql_query",
                    args: { dbId: "db-1", sql: "SELECT 1" }
                })
            })
        );
    });

    it("includes workspace prefix when workspaceId provided", async () => {
        const mockResponse = { ok: true, result: {} };
        vi.mocked(global.fetch).mockResolvedValueOnce({
            json: () => Promise.resolve(mockResponse)
        } as Response);

        await fragmentCallTool(
            "https://api.example.com",
            "test-token",
            "workspace-456",
            "frag-123",
            "todo_list",
            {}
        );

        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.example.com/w/workspace-456/fragments/frag-123/call",
            expect.anything()
        );
    });

    it("returns result on success", async () => {
        const expectedResult = { rows: [{ id: 1, name: "test" }] };
        vi.mocked(global.fetch).mockResolvedValueOnce({
            json: () => Promise.resolve({ ok: true, result: expectedResult })
        } as Response);

        const result = await fragmentCallTool(
            "https://api.example.com",
            "test-token",
            null,
            "frag-123",
            "psql_query",
            { dbId: "db-1", sql: "SELECT * FROM test" }
        );

        expect(result).toEqual(expectedResult);
    });

    it("throws error on failure response", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            json: () => Promise.resolve({ ok: false, error: "Tool not allowed" })
        } as Response);

        await expect(
            fragmentCallTool(
                "https://api.example.com",
                "test-token",
                null,
                "frag-123",
                "write",
                {}
            )
        ).rejects.toThrow("Tool not allowed");
    });

    it("throws generic error when no error message provided", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            json: () => Promise.resolve({ ok: false })
        } as Response);

        await expect(
            fragmentCallTool(
                "https://api.example.com",
                "test-token",
                null,
                "frag-123",
                "unknown_tool",
                {}
            )
        ).rejects.toThrow("Tool call failed");
    });
});
