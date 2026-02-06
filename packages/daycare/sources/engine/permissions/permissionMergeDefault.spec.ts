import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "../permissions.js";
import { permissionMergeDefault } from "./permissionMergeDefault.js";

describe("permissionMergeDefault", () => {
  it("falls back to defaults and merges directories", () => {
    const permissions: SessionPermissions = {
      workingDir: "",
      writeDirs: ["/custom-write"],
      readDirs: [],
      network: false
    };
    const defaults: SessionPermissions = {
      workingDir: "/workspace",
      writeDirs: ["/base-write"],
      readDirs: ["/base-read"],
      network: true
    };

    const merged = permissionMergeDefault(permissions, defaults);

    expect(merged.workingDir).toBe("/workspace");
    expect(merged.network).toBe(true);
    expect(merged.writeDirs).toEqual(
      expect.arrayContaining(["/base-write", "/custom-write"])
    );
    expect(merged.readDirs).toEqual(expect.arrayContaining(["/base-read"]));
  });

  it("falls back to defaults when workingDir is whitespace-only", () => {
    const permissions: SessionPermissions = {
      workingDir: "   ",
      writeDirs: [],
      readDirs: [],
      network: false
    };
    const defaults: SessionPermissions = {
      workingDir: "/workspace",
      writeDirs: [],
      readDirs: [],
      network: false
    };

    const merged = permissionMergeDefault(permissions, defaults);

    expect(merged.workingDir).toBe("/workspace");
  });

  it("preserves valid workingDir from permissions", () => {
    const permissions: SessionPermissions = {
      workingDir: "/custom-workspace",
      writeDirs: [],
      readDirs: [],
      network: false
    };
    const defaults: SessionPermissions = {
      workingDir: "/workspace",
      writeDirs: [],
      readDirs: [],
      network: false
    };

    const merged = permissionMergeDefault(permissions, defaults);

    expect(merged.workingDir).toBe("/custom-workspace");
  });
});
