import { describe, it, expect } from "vitest";

import { permissionTagsApply } from "./permissionTagsApply.js";

describe("permissionTagsApply", () => {
  it("applies tags to permissions", () => {
    const permissions = {
      workingDir: "/tmp",
      writeDirs: [],
      readDirs: [],
      network: false
    };
    permissionTagsApply(permissions, ["@network", "@read:/tmp"]);
    expect(permissions.network).toBe(true);
    expect(permissions.readDirs).toContain("/tmp");
  });
});
