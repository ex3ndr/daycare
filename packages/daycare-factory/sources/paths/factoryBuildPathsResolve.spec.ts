import { describe, expect, it } from "vitest";
import { factoryBuildPathsResolve } from "./factoryBuildPathsResolve.js";

describe("factoryBuildPathsResolve", () => {
  it("resolves relative config and out paths against task directory", () => {
    const result = factoryBuildPathsResolve(
      "/tmp/task-a",
      "daycare-factory.yaml",
      "out"
    );

    expect(result.taskDirectory).toBe("/tmp/task-a");
    expect(result.taskFilePath).toBe("/tmp/task-a/TASK.md");
    expect(result.configPath).toBe("/tmp/task-a/daycare-factory.yaml");
    expect(result.outDirectory).toBe("/tmp/task-a/out");
  });

  it("preserves absolute config and out paths", () => {
    const result = factoryBuildPathsResolve(
      "/tmp/task-a",
      "/etc/daycare-factory.yaml",
      "/tmp/output"
    );

    expect(result.configPath).toBe("/etc/daycare-factory.yaml");
    expect(result.outDirectory).toBe("/tmp/output");
  });
});
