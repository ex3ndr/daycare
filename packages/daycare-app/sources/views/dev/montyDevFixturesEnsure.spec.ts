import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
    databaseQuery: vi.fn(),
    fetch: vi.fn()
}));

vi.mock("../../modules/databases/databaseQuery", () => ({
    databaseQuery: mockState.databaseQuery
}));

import { montyDevFixturesEnsure } from "./montyDevFixturesEnsure";

describe("montyDevFixturesEnsure", () => {
    beforeEach(() => {
        mockState.databaseQuery.mockReset();
        mockState.fetch.mockReset();
        vi.stubGlobal("fetch", mockState.fetch);
    });

    it("creates, schemas, and seeds the fixture database when missing", async () => {
        mockState.fetch
            .mockResolvedValueOnce(jsonResponse({ ok: true, databases: [] }))
            .mockResolvedValueOnce(
                jsonResponse({ ok: true, database: { id: "db-1", name: "Monty Fragment Fixtures" } })
            )
            .mockResolvedValueOnce(jsonResponse({ ok: true, result: { errors: [] } }))
            .mockResolvedValueOnce(jsonResponse({ ok: true, row: { id: "r1" } }))
            .mockResolvedValueOnce(jsonResponse({ ok: true, row: { id: "r2" } }))
            .mockResolvedValueOnce(jsonResponse({ ok: true, row: { id: "r3" } }));
        mockState.databaseQuery.mockResolvedValue([{ count: 0 }]);

        const result = await montyDevFixturesEnsure({
            baseUrl: "http://api.localhost:1355",
            token: "jwt-token",
            workspaceId: null
        });

        expect(result).toEqual({
            databaseId: "db-1",
            created: true,
            seeded: true
        });
        expect(mockState.databaseQuery).toHaveBeenCalledWith(
            "http://api.localhost:1355",
            "jwt-token",
            null,
            "db-1",
            'SELECT COUNT(*) AS "count" FROM "inventory" WHERE "valid_to" IS NULL'
        );
        expect(mockState.fetch).toHaveBeenCalledTimes(6);
    });
});

function jsonResponse(payload: Record<string, unknown>): Response {
    return {
        json: async () => payload
    } as Response;
}
