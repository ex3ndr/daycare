import { describe, it, expect } from "vitest";
import path from "node:path";

import {
  parsePermissionTag,
  parsePermissionTags,
  formatPermissionTag,
  fromLegacyPermissions,
  toLegacyPermissions,
  normalizePermissionTags,
  createSandboxPermissions
} from "./legacy.js";
import { PermissionSet } from "./permissionSet.js";

describe("parsePermissionTag", () => {
  it("parses @network", () => {
    const cap = parsePermissionTag("@network");
    expect(cap.kind).toBe("network");
  });

  it("parses @events", () => {
    const cap = parsePermissionTag("@events");
    expect(cap.kind).toBe("events");
  });

  it("parses @read with path", () => {
    const cap = parsePermissionTag("@read:/home/user/docs");
    expect(cap.kind).toBe("file:read");
    if (cap.kind === "file:read") {
      expect(cap.path).toBe(path.resolve("/home/user/docs"));
      expect(cap.recursive).toBe(true);
    }
  });

  it("parses @write with path", () => {
    const cap = parsePermissionTag("@write:/home/user/workspace");
    expect(cap.kind).toBe("file:write");
    if (cap.kind === "file:write") {
      expect(cap.path).toBe(path.resolve("/home/user/workspace"));
      expect(cap.recursive).toBe(true);
    }
  });

  it("trims whitespace", () => {
    const cap = parsePermissionTag("  @network  ");
    expect(cap.kind).toBe("network");
  });

  it("throws on invalid tag", () => {
    expect(() => parsePermissionTag("invalid")).toThrow();
    expect(() => parsePermissionTag("@unknown")).toThrow();
    expect(() => parsePermissionTag("@read:")).toThrow();
    expect(() => parsePermissionTag("@write:")).toThrow();
  });
});

describe("parsePermissionTags", () => {
  it("parses multiple valid tags", () => {
    const caps = parsePermissionTags(["@network", "@events", "@read:/tmp"]);
    expect(caps).toHaveLength(3);
    expect(caps.map((c) => c.kind)).toEqual(["network", "events", "file:read"]);
  });

  it("skips invalid tags", () => {
    const caps = parsePermissionTags(["@network", "invalid", "@events"]);
    expect(caps).toHaveLength(2);
  });
});

describe("formatPermissionTag", () => {
  it("formats network capability", () => {
    expect(formatPermissionTag({ kind: "network" })).toBe("@network");
  });

  it("formats events capability", () => {
    expect(formatPermissionTag({ kind: "events" })).toBe("@events");
  });

  it("formats read capability", () => {
    expect(
      formatPermissionTag({ kind: "file:read", path: "/tmp", recursive: true })
    ).toBe("@read:/tmp");
  });

  it("formats write capability", () => {
    expect(
      formatPermissionTag({ kind: "file:write", path: "/tmp", recursive: true })
    ).toBe("@write:/tmp");
  });
});

describe("fromLegacyPermissions", () => {
  it("converts basic legacy permissions", () => {
    const legacy = {
      workingDir: "/home/user/workspace",
      writeDirs: ["/home/user/workspace"],
      readDirs: [],
      network: true,
      events: false
    };

    const perms = fromLegacyPermissions(legacy, "test");

    expect(perms.workspacePath).toBe(path.resolve("/home/user/workspace"));
    expect(perms.hasNetwork).toBe(true);
    expect(perms.hasEvents).toBe(false);
  });

  it("adds explicit write dirs", () => {
    const legacy = {
      workingDir: "/home/user/workspace",
      writeDirs: ["/home/user/workspace", "/home/user/documents"],
      readDirs: [],
      network: false,
      events: false
    };

    const perms = fromLegacyPermissions(legacy, "test");

    expect(perms.allowsWriteSync("/home/user/workspace/file.txt")).toBe(true);
    expect(perms.allowsWriteSync("/home/user/documents/file.txt")).toBe(true);
  });

  it("adds explicit read dirs", () => {
    const legacy = {
      workingDir: "/home/user/workspace",
      writeDirs: [],
      readDirs: ["/home/user/downloads"],
      network: false,
      events: false
    };

    const perms = fromLegacyPermissions(legacy, "test");

    expect(perms.allowsReadSync("/home/user/downloads/file.txt")).toBe(true);
  });
});

describe("toLegacyPermissions", () => {
  it("converts back to legacy format", () => {
    const perms = PermissionSet.create({
      id: "test",
      workspacePath: "/home/user/workspace",
      capabilities: [
        { kind: "network" },
        { kind: "events" },
        { kind: "file:write", path: "/home/user/documents", recursive: true }
      ]
    });

    const legacy = toLegacyPermissions(perms);

    expect(legacy.workingDir).toBe("/home/user/workspace");
    expect(legacy.network).toBe(true);
    expect(legacy.events).toBe(true);
    expect(legacy.writeDirs).toContain("/home/user/workspace");
    expect(legacy.writeDirs).toContain("/home/user/documents");
  });

  it("handles permission set without workspace", () => {
    const perms = PermissionSet.create({
      id: "test",
      capabilities: [
        { kind: "file:write", path: "/tmp", recursive: true }
      ]
    });

    const legacy = toLegacyPermissions(perms);

    expect(legacy.workingDir).toBe("/tmp");
    expect(legacy.writeDirs).toContain("/tmp");
  });
});

describe("normalizePermissionTags", () => {
  it("deduplicates tags", () => {
    const result = normalizePermissionTags(["@network", "@network", "@events"]);
    expect(result).toEqual(["@network", "@events"]);
  });

  it("handles non-array input", () => {
    const result = normalizePermissionTags("@network");
    expect(result).toEqual(["@network"]);
  });

  it("skips invalid entries", () => {
    const result = normalizePermissionTags(["@network", 123, null, "@events"]);
    expect(result).toEqual(["@network", "@events"]);
  });

  it("skips invalid tags", () => {
    const result = normalizePermissionTags(["@network", "@invalid", "@events"]);
    expect(result).toEqual(["@network", "@events"]);
  });
});

describe("createSandboxPermissions", () => {
  it("returns empty permissions with no tags", () => {
    const source = PermissionSet.create({
      id: "source",
      workspacePath: "/workspace",
      capabilities: [{ kind: "network" }]
    });

    const sandbox = createSandboxPermissions(source, []);

    expect(sandbox.hasNetwork).toBe(false);
    expect(sandbox.hasEvents).toBe(false);
  });

  it("allows network if source has it", () => {
    const source = PermissionSet.create({
      id: "source",
      capabilities: [{ kind: "network" }]
    });

    const sandbox = createSandboxPermissions(source, ["@network"]);

    expect(sandbox.hasNetwork).toBe(true);
  });

  it("throws if requesting network without source permission", () => {
    const source = PermissionSet.create({
      id: "source",
      capabilities: []
    });

    expect(() =>
      createSandboxPermissions(source, ["@network"])
    ).toThrow("Cannot attach @network");
  });

  it("allows write if source has it", () => {
    const source = PermissionSet.create({
      id: "source",
      capabilities: [{ kind: "file:write", path: "/tmp", recursive: true }]
    });

    const sandbox = createSandboxPermissions(source, ["@write:/tmp"]);

    expect(sandbox.allowsWriteSync("/tmp/file.txt")).toBe(true);
  });

  it("throws if requesting write outside source permissions", () => {
    const source = PermissionSet.create({
      id: "source",
      capabilities: [{ kind: "file:write", path: "/tmp", recursive: true }]
    });

    expect(() =>
      createSandboxPermissions(source, ["@write:/home/other"])
    ).toThrow("Cannot attach @write");
  });

  it("ignores @read tags", () => {
    const source = PermissionSet.create({
      id: "source",
      capabilities: [{ kind: "file:read", path: "/docs", recursive: true }]
    });

    const sandbox = createSandboxPermissions(source, ["@read:/docs"]);

    // Read tags are filtered out in exec context
    expect(sandbox.capabilities.filter((c) => c.kind === "file:read")).toHaveLength(0);
  });
});
