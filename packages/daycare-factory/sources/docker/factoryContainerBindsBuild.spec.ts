import { describe, expect, it } from "vitest";
import { factoryContainerBindsBuild } from "./factoryContainerBindsBuild.js";

describe("factoryContainerBindsBuild", () => {
  it("builds readonly TASK.md and writable out mount strings", () => {
    const binds = factoryContainerBindsBuild(
      {
        taskDirectory: "/tmp/task",
        taskFilePath: "/tmp/task/TASK.md",
        configPath: "/tmp/task/daycare-factory.yaml",
        outDirectory: "/tmp/task/out"
      },
      {
        image: "daycare/factory:latest",
        containerName: "container",
        command: ["daycare-factory"],
        workingDirectory: "/workspace",
        taskMountPath: "/workspace/TASK.md",
        outMountPath: "/workspace/out",
        env: {},
        removeExistingContainer: true,
        removeContainerOnExit: true
      }
    );

    expect(binds).toEqual([
      "/tmp/task/TASK.md:/workspace/TASK.md:ro",
      "/tmp/task/out:/workspace/out"
    ]);
  });
});
