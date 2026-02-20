import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { gatePermissionsCheck } from "./gatePermissionsCheck.js";

const basePermissions: SessionPermissions = {
    workspaceDir: "/tmp",
    workingDir: "/tmp",
    readDirs: ["/tmp"],
    writeDirs: ["/tmp"],
    network: false,
    events: false
};

describe("gatePermissionsCheck", () => {
    it("allows empty tags", async () => {
        const result = await gatePermissionsCheck(basePermissions);
        expect(result).toEqual({ allowed: true, missing: [] });
    });

    it("denies network when not allowed", async () => {
        const result = await gatePermissionsCheck(basePermissions, ["@network"]);
        expect(result.allowed).toBe(false);
        expect(result.missing).toEqual(["@network"]);
    });

    it("allows network when permitted", async () => {
        const permissions: SessionPermissions = { ...basePermissions, network: true };
        const result = await gatePermissionsCheck(permissions, ["@network"]);
        expect(result).toEqual({ allowed: true, missing: [] });
    });

    it("denies events when not allowed", async () => {
        const result = await gatePermissionsCheck(basePermissions, ["@events"]);
        expect(result.allowed).toBe(false);
        expect(result.missing).toEqual(["@events"]);
    });

    it("allows events when permitted", async () => {
        const permissions: SessionPermissions = { ...basePermissions, events: true };
        const result = await gatePermissionsCheck(permissions, ["@events"]);
        expect(result).toEqual({ allowed: true, missing: [] });
    });

    it("denies workspace when not allowed", async () => {
        const appPermissions: SessionPermissions = {
            workspaceDir: "/tmp",
            workingDir: "/tmp/apps/my-app/data",
            readDirs: ["/tmp"],
            writeDirs: ["/tmp/apps/my-app/data"],
            network: false,
            events: false
        };
        const result = await gatePermissionsCheck(appPermissions, ["@workspace"]);
        expect(result.allowed).toBe(false);
        expect(result.missing).toEqual(["@workspace"]);
    });

    it("allows workspace when permitted", async () => {
        const permissions: SessionPermissions = { ...basePermissions };
        const result = await gatePermissionsCheck(permissions, ["@workspace"]);
        expect(result).toEqual({ allowed: true, missing: [] });
    });

    it("denies paths outside allowed roots", async () => {
        const result = await gatePermissionsCheck(basePermissions, ["@read:/etc"]);
        expect(result.allowed).toBe(false);
        expect(result.missing).toEqual(["@read:/etc"]);
    });

    it("reports invalid permission tags", async () => {
        const result = await gatePermissionsCheck(basePermissions, ["@banana"]);
        expect(result.allowed).toBe(false);
        expect(result.missing).toEqual([
            "@banana (Permission must be @network, @events, @workspace, @read:<path>, or @write:<path>.)"
        ]);
    });
});
