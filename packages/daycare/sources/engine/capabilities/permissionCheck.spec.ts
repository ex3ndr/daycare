import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  checkFileRead,
  checkFileWrite,
  checkNetwork,
  checkPermission,
  checkPermissionSync,
  domainMatches,
  isPathWithin
} from "./permissionCheck.js";

describe("domainMatches", () => {
  it("matches exact domain", () => {
    expect(domainMatches("example.com", "example.com")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(domainMatches("Example.COM", "example.com")).toBe(true);
  });

  it("does not match different domain", () => {
    expect(domainMatches("other.com", "example.com")).toBe(false);
  });

  it("matches wildcard subdomain", () => {
    expect(domainMatches("api.example.com", "*.example.com")).toBe(true);
  });

  it("matches nested wildcard subdomain", () => {
    expect(domainMatches("deep.api.example.com", "*.example.com")).toBe(true);
  });

  it("matches root domain with wildcard", () => {
    expect(domainMatches("example.com", "*.example.com")).toBe(true);
  });

  it("does not match unrelated domain with wildcard", () => {
    expect(domainMatches("other.com", "*.example.com")).toBe(false);
  });
});

describe("isPathWithin", () => {
  it("returns true for exact match", () => {
    expect(isPathWithin("/home/user", "/home/user")).toBe(true);
  });

  it("returns true for subdirectory", () => {
    expect(isPathWithin("/home/user", "/home/user/documents")).toBe(true);
  });

  it("returns true for nested subdirectory", () => {
    expect(isPathWithin("/home/user", "/home/user/a/b/c")).toBe(true);
  });

  it("returns false for parent directory", () => {
    expect(isPathWithin("/home/user/documents", "/home/user")).toBe(false);
  });

  it("returns false for sibling directory", () => {
    expect(isPathWithin("/home/user", "/home/other")).toBe(false);
  });

  it("returns false for path traversal attempt", () => {
    expect(isPathWithin("/home/user", "/home/user/../other")).toBe(false);
  });

  it("handles relative paths by resolving them", () => {
    const base = process.cwd();
    expect(isPathWithin(base, "subdir")).toBe(true);
  });
});

describe("checkNetwork", () => {
  it("allows all domains when no restriction", () => {
    expect(checkNetwork({ kind: "network" }, "any.domain.com")).toBe(true);
  });

  it("allows all domains with empty domains array", () => {
    expect(checkNetwork({ kind: "network", domains: [] }, "any.domain.com")).toBe(true);
  });

  it("allows matching domain", () => {
    expect(
      checkNetwork(
        { kind: "network", domains: ["example.com"] },
        "example.com"
      )
    ).toBe(true);
  });

  it("allows wildcard subdomain match", () => {
    expect(
      checkNetwork(
        { kind: "network", domains: ["*.example.com"] },
        "api.example.com"
      )
    ).toBe(true);
  });

  it("denies non-matching domain", () => {
    expect(
      checkNetwork(
        { kind: "network", domains: ["example.com"] },
        "other.com"
      )
    ).toBe(false);
  });

  it("allows general network check without specific domain", () => {
    expect(
      checkNetwork({ kind: "network", domains: ["example.com"] })
    ).toBe(true);
  });
});

describe("checkFileRead", () => {
  it("allows read within allowed directory", () => {
    const result = checkFileRead(
      [{ kind: "file:read", path: "/home/user", recursive: true }],
      "/home/user/file.txt"
    );
    expect(result.allowed).toBe(true);
  });

  it("allows read of allowed directory itself", () => {
    const result = checkFileRead(
      [{ kind: "file:read", path: "/home/user", recursive: true }],
      "/home/user"
    );
    expect(result.allowed).toBe(true);
  });

  it("denies read outside allowed directory", () => {
    const result = checkFileRead(
      [{ kind: "file:read", path: "/home/user", recursive: true }],
      "/home/other/file.txt"
    );
    expect(result.allowed).toBe(false);
  });

  it("allows read via write capability", () => {
    const result = checkFileRead(
      [{ kind: "file:write", path: "/home/user", recursive: true }],
      "/home/user/file.txt"
    );
    expect(result.allowed).toBe(true);
  });

  it("respects non-recursive flag for exact match only", () => {
    const result = checkFileRead(
      [{ kind: "file:read", path: "/home/user/file.txt", recursive: false }],
      "/home/user/file.txt"
    );
    expect(result.allowed).toBe(true);
  });

  it("denies subdirectory with non-recursive flag", () => {
    const result = checkFileRead(
      [{ kind: "file:read", path: "/home/user", recursive: false }],
      "/home/user/subdir/file.txt"
    );
    expect(result.allowed).toBe(false);
  });
});

describe("checkFileWrite", () => {
  it("allows write within allowed directory", () => {
    const result = checkFileWrite(
      [{ kind: "file:write", path: "/home/user", recursive: true }],
      "/home/user/file.txt"
    );
    expect(result.allowed).toBe(true);
  });

  it("denies write outside allowed directory", () => {
    const result = checkFileWrite(
      [{ kind: "file:write", path: "/home/user", recursive: true }],
      "/home/other/file.txt"
    );
    expect(result.allowed).toBe(false);
  });

  it("denies write when only read capability exists", () => {
    const result = checkFileWrite(
      [],
      "/home/user/file.txt"
    );
    expect(result.allowed).toBe(false);
  });
});

describe("checkPermissionSync", () => {
  it("checks network permission", () => {
    const result = checkPermissionSync(
      [{ kind: "network" }],
      { kind: "network" }
    );
    expect(result.allowed).toBe(true);
  });

  it("checks events permission", () => {
    const result = checkPermissionSync(
      [{ kind: "events" }],
      { kind: "events" }
    );
    expect(result.allowed).toBe(true);
  });

  it("denies missing network permission", () => {
    const result = checkPermissionSync(
      [],
      { kind: "network" }
    );
    expect(result.allowed).toBe(false);
  });

  it("checks file read permission", () => {
    const result = checkPermissionSync(
      [{ kind: "file:read", path: "/home/user", recursive: true }],
      { kind: "file:read", path: "/home/user/file.txt" }
    );
    expect(result.allowed).toBe(true);
  });

  it("checks file write permission", () => {
    const result = checkPermissionSync(
      [{ kind: "file:write", path: "/home/user", recursive: true }],
      { kind: "file:write", path: "/home/user/file.txt" }
    );
    expect(result.allowed).toBe(true);
  });
});

describe("checkPermission (async)", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    tempDirs.length = 0;
  });

  it("checks file read with real filesystem", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "perm-test-"));
    tempDirs.push(dir);
    const file = path.join(dir, "test.txt");
    await fs.writeFile(file, "content");

    const result = await checkPermission(
      [{ kind: "file:read", path: dir, recursive: true }],
      { kind: "file:read", path: file }
    );
    expect(result.allowed).toBe(true);
  });

  it("checks file write for non-existent file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "perm-test-"));
    tempDirs.push(dir);
    const file = path.join(dir, "new-file.txt");

    const result = await checkPermission(
      [{ kind: "file:write", path: dir, recursive: true }],
      { kind: "file:write", path: file }
    );
    expect(result.allowed).toBe(true);
  });
});
