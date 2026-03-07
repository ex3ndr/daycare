import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
    databaseQuery: vi.fn()
}));

vi.mock("@/modules/databases/databaseQuery", () => ({
    databaseQuery: mockState.databaseQuery
}));

import { montyFragmentExternalFunctionsBuild } from "./montyFragmentExternalFunctionsBuild";

describe("montyFragmentExternalFunctionsBuild", () => {
    beforeEach(() => {
        mockState.databaseQuery.mockReset();
    });

    it("only exposes query helpers", () => {
        const externalFunctions = montyFragmentExternalFunctionsBuild({
            baseUrl: null,
            token: null,
            workspaceId: null
        });

        expect(Object.keys(externalFunctions)).toEqual(["query_database"]);
    });

    it("queries the backend database with auth", async () => {
        mockState.databaseQuery.mockResolvedValue([{ id: "1" }]);
        const externalFunctions = montyFragmentExternalFunctionsBuild({
            baseUrl: "http://localhost:7332",
            token: "jwt-token",
            workspaceId: null
        });

        await expect(externalFunctions.query_database("crm", "SELECT 1", [1])).resolves.toEqual([{ id: "1" }]);
        expect(mockState.databaseQuery).toHaveBeenCalledWith(
            "http://localhost:7332",
            "jwt-token",
            null,
            "crm",
            "SELECT 1",
            [1]
        );
    });

    it("rejects database queries without auth", async () => {
        const externalFunctions = montyFragmentExternalFunctionsBuild({
            baseUrl: null,
            token: null,
            workspaceId: null
        });

        await expect(externalFunctions.query_database("crm", "SELECT 1")).rejects.toThrow(
            "query_database() requires an authenticated app session."
        );
    });
});
