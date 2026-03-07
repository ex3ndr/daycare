import { describe, expect, it } from "vitest";
import { documentWorkspaceIdResolve } from "./documentWorkspaceIdResolve";

describe("documentWorkspaceIdResolve", () => {
    it("prefers the workspace from the route", () => {
        expect(documentWorkspaceIdResolve("route-workspace", "store-workspace")).toBe("route-workspace");
    });

    it("uses the first route workspace when params are repeated", () => {
        expect(documentWorkspaceIdResolve(["", "route-workspace", "other"], "store-workspace")).toBe("route-workspace");
    });

    it("falls back to the active workspace when the route is missing", () => {
        expect(documentWorkspaceIdResolve(undefined, "store-workspace")).toBe("store-workspace");
        expect(documentWorkspaceIdResolve([], "store-workspace")).toBe("store-workspace");
    });

    it("returns null when neither route nor active workspace is available", () => {
        expect(documentWorkspaceIdResolve(undefined, null)).toBeNull();
    });
});
