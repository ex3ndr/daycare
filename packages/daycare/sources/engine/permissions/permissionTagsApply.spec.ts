import { describe, it, expect } from "vitest";

import { permissionTagsApply } from "./permissionTagsApply.js";

describe("permissionTagsApply", () => {
  it("applies tags to permissions", () => {
    const permissions = {
      workingDir: "/tmp",
      writeDirs: [],
      readDirs: [],
      network: false,
      events: false
    };
    permissionTagsApply(permissions, ["@network", "@events", "@read:/tmp", "@write:/var/tmp"]);
    expect(permissions.network).toBe(true);
    expect(permissions.events).toBe(true);
    expect(permissions.readDirs).toContain("/tmp");
    expect(permissions.readDirs).toContain("/var/tmp");
    expect(permissions.writeDirs).toContain("/var/tmp");
  });
});
