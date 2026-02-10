import { describe, expect, it } from "vitest";
import { factoryContainerBindsBuild } from "./factoryContainerBindsBuild.js";

describe("factoryContainerBindsBuild", () => {
  it("builds readonly TASK.md/template and writable out mount strings", () => {
    const binds = factoryContainerBindsBuild(
      {
        taskDirectory: "/tmp/task",
        environmentDirectory: "/tmp/environment",
        taskFilePath: "/tmp/task/TASK.md",
        templateDirectory: "/tmp/environment/template",
        configPath: "/tmp/task/daycare-factory.yaml",
        outDirectory: "/tmp/task/out"
      },
      {
        image: "daycare/factory:latest",
        buildCommand: ["npm", "run", "build"],
        testMaxAttempts: 5,
        containerName: "container",
        command: ["daycare-factory"],
        workingDirectory: "/workspace",
        taskMountPath: "/workspace/TASK.md",
        templateMountPath: "/workspace/template",
        outMountPath: "/workspace/out",
        env: {},
        removeExistingContainer: true,
        removeContainerOnExit: true
      }
    );

    expect(binds).toEqual([
      "/tmp/task/TASK.md:/workspace/TASK.md:ro",
      "/tmp/environment/template:/workspace/template:ro",
      "/tmp/task/out:/workspace/out"
    ]);
  });
});
