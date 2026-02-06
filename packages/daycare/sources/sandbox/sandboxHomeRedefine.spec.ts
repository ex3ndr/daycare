import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { sandboxHomeRedefine } from "./sandboxHomeRedefine.js";

describe("sandboxHomeRedefine", () => {
  it("keeps environment unchanged when disabled", async () => {
    const baseEnv: NodeJS.ProcessEnv = { HOME: "/home/original", FOO: "bar" };

    const result = await sandboxHomeRedefine({
      env: baseEnv,
      home: undefined
    });

    expect(result.env).toBe(baseEnv);
    expect(result.homeDir).toBeUndefined();
  });

  it("overrides home-related env vars and ensures directories", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-home-"));
    try {
      const homeDir = path.join(workspace, ".sandbox-home");
      const result = await sandboxHomeRedefine({
        env: { HOME: "/home/original" },
        home: homeDir
      });

      const expectedHome = homeDir;
      expect(result.homeDir).toBe(expectedHome);
      expect(result.env.HOME).toBe(expectedHome);
      expect(result.env.USERPROFILE).toBe(expectedHome);
      expect(result.env.XDG_CONFIG_HOME).toBe(path.join(expectedHome, ".config"));
      expect(result.env.DOTNET_CLI_HOME).toBe(expectedHome);
      expect(result.env.COMPOSER_HOME).toBe(path.join(expectedHome, ".composer"));

      await expect(fs.stat(expectedHome)).resolves.toBeTruthy();
      await expect(fs.stat(path.join(expectedHome, ".cargo"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(expectedHome, ".nuget", "packages"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(expectedHome, ".composer"))).resolves.toBeTruthy();
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  });
});
