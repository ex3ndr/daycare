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

  it("defaults rlm to false", () => {
    const configPath = path.join("/tmp/daycare", "settings.json");
    const config = configResolve({}, configPath);
    expect(config.rlm).toBe(false);
  });

  it("resolves rlm from settings", () => {
    const configPath = path.join("/tmp/daycare", "settings.json");
    const config = configResolve({ rlm: true }, configPath);
    expect(config.rlm).toBe(true);
  });

  it("defaults security.appReviewerEnabled to true", () => {
    const configPath = path.join("/tmp/daycare", "settings.json");
    const config = configResolve({}, configPath);
    expect(config.settings.security.appReviewerEnabled).toBe(true);
  });

  it("resolves security.appReviewerEnabled from settings", () => {
    const configPath = path.join("/tmp/daycare", "settings.json");
    const config = configResolve(
      { security: { appReviewerEnabled: false } },
      configPath
    );
    expect(config.settings.security.appReviewerEnabled).toBe(false);
  });
});
