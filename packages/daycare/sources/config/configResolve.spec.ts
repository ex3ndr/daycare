import path from "node:path";

import { describe, expect, it } from "vitest";

import { configResolve } from "./configResolve.js";

describe("configResolve", () => {
  it("resolves filesDir under workspace/files", () => {
    const configPath = path.join("/tmp/daycare", "settings.json");
    const config = configResolve(
      {
        assistant: {
          workspaceDir: "/tmp/daycare/workspace"
        },
        engine: {
          dataDir: "/tmp/daycare/.daycare"
        }
      },
      configPath
    );

    expect(config.workspaceDir).toBe(path.resolve("/tmp/daycare/workspace"));
    expect(config.filesDir).toBe(path.resolve("/tmp/daycare/workspace/files"));
  });
});
