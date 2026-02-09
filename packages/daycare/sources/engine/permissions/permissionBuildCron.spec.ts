import path from "node:path";

import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "../permissions.js";
import { permissionBuildCron } from "./permissionBuildCron.js";

describe("permissionBuildCron", () => {
  it("copies defaults into cron permissions", () => {
    const defaults: SessionPermissions = {
      workingDir: path.resolve("tmp", "workspace"),
      writeDirs: [path.resolve("tmp", "write")],
      readDirs: [path.resolve("tmp", "read")],
      network: true,
      events: false
    };

    const permissions = permissionBuildCron(defaults, path.resolve("tmp", "cron"));

    expect(permissions.workingDir).toBe(path.resolve("tmp", "cron"));
    expect(permissions.writeDirs).toEqual(expect.arrayContaining(defaults.writeDirs));
    expect(permissions.readDirs).toEqual(expect.arrayContaining(defaults.readDirs));
    expect(permissions.network).toBe(true);
    expect(permissions.events).toBe(false);
  });
});
