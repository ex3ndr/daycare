import { describe, expect, it } from "vitest";
import { FACTORY_INTERNAL_COMMAND } from "../constants.js";
import { factoryConfigResolve } from "./factoryConfigResolve.js";

describe("factoryConfigResolve", () => {
  it("applies defaults for mount paths and command", () => {
    const result = factoryConfigResolve({
      image: "daycare/factory:latest",
      buildCommand: ["npm", "run", "build"]
    });

    expect(result.taskMountPath).toBe("/workspace/TASK.md");
    expect(result.templateMountPath).toBe("/workspace/template");
    expect(result.outMountPath).toBe("/workspace/out");
    expect(result.buildCommand).toEqual(["npm", "run", "build"]);
    expect(result.testCommand).toBeUndefined();
    expect(result.testMaxAttempts).toBe(5);
    expect(result.command).toEqual([
      "daycare-factory",
      FACTORY_INTERNAL_COMMAND,
      "--task",
      "/workspace/TASK.md",
      "--template",
      "/workspace/template",
      "--out",
      "/workspace/out"
    ]);
    expect(result.removeExistingContainer).toBe(true);
    expect(result.removeContainerOnExit).toBe(true);
  });

  it("builds default command from custom mount paths", () => {
    const result = factoryConfigResolve({
      image: "daycare/factory:latest",
      buildCommand: ["pnpm", "build"],
      taskMountPath: "/custom/TASK.md",
      templateMountPath: "/custom/template",
      outMountPath: "/custom/out"
    });

    expect(result.command).toEqual([
      "daycare-factory",
      FACTORY_INTERNAL_COMMAND,
      "--task",
      "/custom/TASK.md",
      "--template",
      "/custom/template",
      "--out",
      "/custom/out"
    ]);
  });

  it("keeps optional test command", () => {
    const result = factoryConfigResolve({
      image: "daycare/factory:latest",
      buildCommand: ["pnpm", "build"],
      testCommand: ["pnpm", "test"]
    });

    expect(result.testCommand).toEqual(["pnpm", "test"]);
  });

  it("keeps optional test max attempts", () => {
    const result = factoryConfigResolve({
      image: "daycare/factory:latest",
      buildCommand: ["pnpm", "build"],
      testMaxAttempts: 9
    });

    expect(result.testMaxAttempts).toBe(9);
  });

  it("requires buildCommand in config", () => {
    expect(() =>
      factoryConfigResolve({
        image: "daycare/factory:latest"
      })
    ).toThrow();
  });
});
