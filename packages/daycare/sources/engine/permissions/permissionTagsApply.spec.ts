import { describe, it, expect } from "vitest";

import { permissionTagsApply } from "./permissionTagsApply.js";

describe("permissionTagsApply", () => {
  it("applies tags to permissions", () => {
    const permissions = {
      workingDir: "/tmp",
      writeDirs: [],
      readDirs: [],
      web: false
    };
    permissionTagsApply(permissions, ["@web", "@read:/tmp"]);
    expect(permissions.web).toBe(true);
    expect(permissions.readDirs).toContain("/tmp");
  });
});
