import { createStateStore } from "@json-render/core";
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

    it("returns the latest state snapshot", () => {
        const store = createStateStore({ count: 2 });
        const externalFunctions = montyFragmentExternalFunctionsBuild({
            store,
            baseUrl: null,
            token: null,
            workspaceId: null
        });

        expect(externalFunctions.get_state()).toEqual({ count: 2 });
    });

    it("applies state patches", () => {
        const store = createStateStore({ count: 1, nested: { ready: false } });
        const externalFunctions = montyFragmentExternalFunctionsBuild({
            store,
            baseUrl: null,
            token: null,
            workspaceId: null
        });

        expect(externalFunctions._apply_state({ nested: { ready: true } })).toEqual({
            count: 1,
            nested: { ready: true }
        });
        expect(store.getSnapshot()).toEqual({
            count: 1,
            nested: { ready: true }
        });
    });

    it("queries the backend database with auth", async () => {
        mockState.databaseQuery.mockResolvedValue([{ id: "1" }]);
        const store = createStateStore({});
        const externalFunctions = montyFragmentExternalFunctionsBuild({
            store,
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
        const store = createStateStore({});
        const externalFunctions = montyFragmentExternalFunctionsBuild({
            store,
            baseUrl: null,
            token: null,
            workspaceId: null
        });

        await expect(externalFunctions.query_database("crm", "SELECT 1")).rejects.toThrow(
            "query_database() requires an authenticated app session."
        );
    });
});
