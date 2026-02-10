import { describe, expect, it } from "vitest";
import { factoryBuildPathsResolve } from "./factoryBuildPathsResolve.js";

describe("factoryBuildPathsResolve", () => {
  it("resolves environment config and task output paths", () => {
    const result = factoryBuildPathsResolve(
      "/tmp/tasks/task-a",
      "/tmp/environments/bash",
      "daycare-factory.yaml",
      "out"
    );

    expect(result.taskDirectory).toBe("/tmp/tasks/task-a");
    expect(result.environmentDirectory).toBe("/tmp/environments/bash");
    expect(result.taskFilePath).toBe("/tmp/tasks/task-a/TASK.md");
    expect(result.agentsFilePath).toBe("/tmp/tasks/task-a/AGENTS.md");
    expect(result.templateDirectory).toBe("/tmp/environments/bash/template");
    expect(result.configPath).toBe("/tmp/environments/bash/daycare-factory.yaml");
    expect(result.outDirectory).toBe("/tmp/tasks/task-a/out");
  });

  it("preserves absolute config and out paths", () => {
    const result = factoryBuildPathsResolve(
      "/tmp/tasks/task-a",
      "/tmp/environments/typescript",
      "/etc/daycare-factory.yaml",
      "/tmp/output"
    );

    expect(result.configPath).toBe("/etc/daycare-factory.yaml");
    expect(result.outDirectory).toBe("/tmp/output");
  });

  it("rejects when task and environment directories are the same", () => {
    expect(() =>
      factoryBuildPathsResolve(
        "/tmp/task-a",
        "/tmp/task-a",
        "daycare-factory.yaml",
        "out"
      )
    ).toThrow("must be different");
  });
});
