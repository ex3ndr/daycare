import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { permissionAccessAllows } from "./permissionAccessAllows.js";

describe("permissionAccessAllows", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("allows web access when enabled", async () => {
    const allowed = await permissionAccessAllows(
      { workingDir: "/tmp", writeDirs: [], readDirs: [], web: true },
      { kind: "web" }
    );
    expect(allowed).toBe(true);
  });

  it("allows read access within allowed directories", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "perm-allow-"));
    tempDirs.push(dir);
    const target = path.join(dir, "file.txt");
    await fs.writeFile(target, "ok", "utf8");
    const allowed = await permissionAccessAllows(
      { workingDir: dir, writeDirs: [], readDirs: [dir], web: false },
      { kind: "read", path: target }
    );
    expect(allowed).toBe(true);
  });

  it("denies write access outside allowed directories", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "perm-deny-"));
    tempDirs.push(dir);
    const target = path.join(dir, "elsewhere", "file.txt");
    const allowed = await permissionAccessAllows(
      { workingDir: "/tmp", writeDirs: ["/tmp"], readDirs: [], web: false },
      { kind: "write", path: target }
    );
    expect(allowed).toBe(false);
  });
});
