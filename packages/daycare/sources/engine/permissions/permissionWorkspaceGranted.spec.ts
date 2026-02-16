import { describe, expect, it } from "vitest";

import { permissionWorkspaceGranted } from "./permissionWorkspaceGranted.js";

describe("permissionWorkspaceGranted", () => {
  it("returns true for workspace-scoped write permissions", () => {
    expect(
      permissionWorkspaceGranted({
        workspaceDir: "/workspace",
        workingDir: "/workspace",
        writeDirs: ["/workspace"],
        readDirs: ["/workspace"],
        network: false,
        events: false
      })
    ).toBe(true);
  });

  it("returns false for app-scoped default writes", () => {
    expect(
      permissionWorkspaceGranted({
        workspaceDir: "/workspace",
        workingDir: "/workspace/apps/reviewer/data",
        writeDirs: ["/workspace/apps/reviewer/data"],
        readDirs: ["/workspace"],
        network: false,
        events: false
      })
    ).toBe(false);
  });

  it("returns true for app permissions after @workspace grant", () => {
    expect(
      permissionWorkspaceGranted({
        workspaceDir: "/workspace",
        workingDir: "/workspace/apps/reviewer/data",
        writeDirs: ["/workspace/apps/reviewer/data", "/workspace"],
        readDirs: ["/workspace"],
        network: false,
        events: false
      })
    ).toBe(true);
  });
});
