import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "../permissions.js";
import { permissionClone } from "./permissionClone.js";

describe("permissionClone", () => {
  it("clones arrays while preserving values", () => {
    const permissions: SessionPermissions = {
      workingDir: "/tmp/work",
      writeDirs: ["/tmp/work"],
      readDirs: ["/tmp/read"],
      web: false
    };

    const cloned = permissionClone(permissions);

    expect(cloned).toEqual(permissions);
    expect(cloned.writeDirs).not.toBe(permissions.writeDirs);
    expect(cloned.readDirs).not.toBe(permissions.readDirs);
  });
});
