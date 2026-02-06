import { describe, expect, it } from "vitest";
import path from "node:path";

import type { SessionPermissions } from "@/types";
import { sandboxFilesystemPolicyBuild } from "./sandboxFilesystemPolicyBuild.js";

function basePermissions(): SessionPermissions {
  return {
    workingDir: path.resolve("/workspace"),
    writeDirs: [path.resolve("/workspace"), path.resolve("/workspace/tmp")],
    readDirs: [],
    network: false
  };
}

describe("sandboxFilesystemPolicyBuild", () => {
  it("dedupes writable paths", () => {
    const result = sandboxFilesystemPolicyBuild({
      permissions: basePermissions(),
      platform: "linux",
      homeDir: "/home/alice"
    });

    expect(result.allowWrite).toEqual([
      path.resolve("/workspace"),
      path.resolve("/workspace/tmp")
    ]);
  });

  it("adds linux sensitive deny paths to read and write", () => {
    const result = sandboxFilesystemPolicyBuild({
      permissions: basePermissions(),
      platform: "linux",
      homeDir: "/home/alice"
    });

    expect(result.denyRead).toEqual(
      expect.arrayContaining([
        path.resolve("/home/alice/.ssh"),
        path.resolve("/home/alice/.gnupg"),
        path.resolve("/home/alice/.aws"),
        path.resolve("/etc/ssh"),
        path.resolve("/etc/ssl/private"),
        path.resolve("/root/.ssh")
      ])
    );
    expect(result.denyWrite).toEqual(result.denyRead);
  });

  it("adds macOS sensitive deny paths to read and write", () => {
    const result = sandboxFilesystemPolicyBuild({
      permissions: basePermissions(),
      platform: "darwin",
      homeDir: "/Users/alice"
    });

    expect(result.denyRead).toEqual(
      expect.arrayContaining([
        path.resolve("/Users/alice/.ssh"),
        path.resolve("/Users/alice/Library/Keychains"),
        path.resolve("/Users/alice/Library/Application Support/com.apple.TCC"),
        path.resolve("/private/etc/ssh")
      ])
    );
    expect(result.denyWrite).toEqual(result.denyRead);
  });
});
