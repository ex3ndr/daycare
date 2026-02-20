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
    expect(config.dbPath).toBe(path.resolve("/tmp/daycare/.daycare/daycare.db"));
  });

  it("resolves dbPath from settings", () => {
    const configPath = path.join("/tmp/daycare", "settings.json");
    const config = configResolve(
      {
        engine: {
          dataDir: "/tmp/daycare/.daycare",
          dbPath: "/tmp/daycare/custom/daycare.db"
        }
      },
      configPath
    );
    expect(config.dbPath).toBe(path.resolve("/tmp/daycare/custom/daycare.db"));
  });

  it("defaults features to all false", () => {
    const configPath = path.join("/tmp/daycare", "settings.json");
    const config = configResolve({}, configPath);
    expect(config.features).toEqual({ say: false, rlm: false, noTools: false });
  });

  it("resolves features.rlm from settings", () => {
    const configPath = path.join("/tmp/daycare", "settings.json");
    const config = configResolve({ features: { rlm: true } }, configPath);
    expect(config.features.rlm).toBe(true);
    expect(config.features.say).toBe(false);
    expect(config.features.noTools).toBe(false);
  });

  it("resolves features.say from settings", () => {
    const configPath = path.join("/tmp/daycare", "settings.json");
    const config = configResolve({ features: { say: true } }, configPath);
    expect(config.features.say).toBe(true);
    expect(config.features.rlm).toBe(false);
    expect(config.features.noTools).toBe(false);
  });

  it("resolves features.noTools from settings", () => {
    const configPath = path.join("/tmp/daycare", "settings.json");
    const config = configResolve({ features: { noTools: true } }, configPath);
    expect(config.features.noTools).toBe(true);
    expect(config.features.say).toBe(false);
    expect(config.features.rlm).toBe(false);
  });

  it("defaults security.appReviewerEnabled to false", () => {
    const configPath = path.join("/tmp/daycare", "settings.json");
    const config = configResolve({}, configPath);
    expect(config.settings.security.appReviewerEnabled).toBe(false);
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
