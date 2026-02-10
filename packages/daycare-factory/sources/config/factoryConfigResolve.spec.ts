import { describe, expect, it } from "vitest";
import { factoryConfigResolve } from "./factoryConfigResolve.js";

describe("factoryConfigResolve", () => {
  it("applies defaults for mount paths and command", () => {
    const result = factoryConfigResolve({ image: "daycare/factory:latest" });

    expect(result.taskMountPath).toBe("/workspace/TASK.md");
    expect(result.outMountPath).toBe("/workspace/out");
    expect(result.command).toEqual([
      "daycare-factory",
      "build",
      "--task",
      "/workspace/TASK.md",
      "--out",
      "/workspace/out"
    ]);
    expect(result.removeExistingContainer).toBe(true);
    expect(result.removeContainerOnExit).toBe(true);
  });

  it("builds default command from custom mount paths", () => {
    const result = factoryConfigResolve({
      image: "daycare/factory:latest",
      taskMountPath: "/custom/TASK.md",
      outMountPath: "/custom/out"
    });

    expect(result.command).toEqual([
      "daycare-factory",
      "build",
      "--task",
      "/custom/TASK.md",
      "--out",
      "/custom/out"
    ]);
  });
});
