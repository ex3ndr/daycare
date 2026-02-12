import { describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";

import { permissionBuildCronSession } from "./permissionBuildCronSession.js";

describe("permissionBuildCronSession", () => {
  it("keeps runtime grants while enforcing cron workspace", () => {
    const defaults: SessionPermissions = {
      workingDir: "/workspace/daycare",
      writeDirs: ["/workspace/daycare"],
      readDirs: ["/workspace/daycare"],
      network: false,
      events: false
    };
    const current: SessionPermissions = {
      workingDir: "/tmp/old-cron",
      writeDirs: ["/tmp/old-cron", "/tmp/granted-write"],
      readDirs: ["/tmp/old-cron", "/tmp/granted-read"],
      network: true,
      events: true
    };

    const result = permissionBuildCronSession(current, defaults, "/tmp/new-cron");

    expect(result.workingDir).toBe("/tmp/new-cron");
    expect(result.network).toBe(true);
    expect(result.events).toBe(true);
    expect(result.writeDirs).toEqual(
      expect.arrayContaining(["/workspace/daycare", "/tmp/old-cron", "/tmp/granted-write"])
    );
    expect(result.readDirs).toEqual(
      expect.arrayContaining(["/workspace/daycare", "/tmp/old-cron", "/tmp/granted-read"])
    );
  });
});
