import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { gatePermissionsCheck } from "./gatePermissionsCheck.js";

const basePermissions: SessionPermissions = {
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

  it("denies paths outside allowed roots", async () => {
    const result = await gatePermissionsCheck(basePermissions, ["@read:/etc"]);
    expect(result.allowed).toBe(false);
    expect(result.missing).toEqual(["@read:/etc"]);
  });

  it("reports invalid permission tags", async () => {
    const result = await gatePermissionsCheck(basePermissions, ["@banana"]);
    expect(result.allowed).toBe(false);
    expect(result.missing).toEqual([
      "@banana (Permission must be @network, @events, @read:<path>, or @write:<path>.)"
    ]);
  });
});
