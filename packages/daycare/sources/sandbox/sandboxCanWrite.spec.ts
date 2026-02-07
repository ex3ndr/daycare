import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { SessionPermissions } from "@/types";
import { sandboxCanWrite } from "./sandboxCanWrite.js";

describe("sandboxCanWrite", () => {
  let workingDir: string;
  let outsideDir: string;

  beforeEach(async () => {
    workingDir = await fs.mkdtemp(path.join(os.tmpdir(), "sandbox-can-write-workspace-"));
    outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "sandbox-can-write-outside-"));
  });

  afterEach(async () => {
    await fs.rm(workingDir, { recursive: true, force: true });
    await fs.rm(outsideDir, { recursive: true, force: true });
  });

  it("rejects writing within the workspace when not explicitly granted", async () => {
    const permissions = buildPermissions(workingDir, []);
    const target = path.join(workingDir, "nested", "output.txt");

    await expect(sandboxCanWrite(permissions, target))
      .rejects
      .toThrow("Path is outside the allowed directories.");
  });

  it("allows writing within explicitly granted write directories", async () => {
    const permissions = buildPermissions(workingDir, [outsideDir]);
    const target = path.join(outsideDir, "output.txt");

    const result = await sandboxCanWrite(permissions, target);

    expect(result).toBe(path.join(await fs.realpath(outsideDir), "output.txt"));
  });

  it("allows writing in workspace when workspace is explicitly granted", async () => {
    const permissions = buildPermissions(workingDir, [workingDir]);
    const target = path.join(workingDir, "nested", "output.txt");

    const result = await sandboxCanWrite(permissions, target);

    expect(result).toBe(path.join(await fs.realpath(workingDir), "nested", "output.txt"));
  });

  it("rejects paths outside the write allowlist", async () => {
    const permissions = buildPermissions(workingDir, []);
    const target = path.join(outsideDir, "blocked.txt");

    await expect(sandboxCanWrite(permissions, target))
      .rejects
      .toThrow("Path is outside the allowed directories.");
  });
});

function buildPermissions(workingDir: string, writeDirs: string[]): SessionPermissions {
  return {
    workingDir: path.resolve(workingDir),
    readDirs: [],
    writeDirs: writeDirs.map((entry) => path.resolve(entry)),
    network: false
  };
}
