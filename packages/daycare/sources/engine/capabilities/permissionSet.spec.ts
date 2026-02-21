import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { PermissionSet } from "./permissionSet.js";

describe("PermissionSet", () => {
  describe("creation", () => {
    it("creates empty permission set", () => {
      const perms = PermissionSet.empty();
      expect(perms.id).toBe("empty");
      expect(perms.capabilities).toHaveLength(0);
      expect(perms.hasNetwork).toBe(false);
      expect(perms.hasEvents).toBe(false);
    });

    it("creates permission set with workspace", () => {
      const perms = PermissionSet.create({
        id: "test",
        workspacePath: "/home/user/workspace"
      });
      expect(perms.workspacePath).toBe("/home/user/workspace");
      expect(perms.writeCapabilities).toHaveLength(1);
      expect(perms.writeCapabilities[0]?.path).toBe("/home/user/workspace");
    });

    it("creates permission set with explicit capabilities", () => {
      const perms = PermissionSet.create({
        id: "test",
        capabilities: [
          { kind: "network" },
          { kind: "events" },
          { kind: "file:write", path: "/tmp", recursive: true }
        ]
      });
      expect(perms.hasNetwork).toBe(true);
      expect(perms.hasEvents).toBe(true);
      expect(perms.writeCapabilities).toHaveLength(1);
    });
  });

  describe("serialization", () => {
    it("serializes and deserializes", () => {
      const original = PermissionSet.create({
        id: "test",
        label: "Test Permissions",
        workspacePath: "/home/user/workspace",
        capabilities: [{ kind: "network" }]
      });

      const serialized = original.serialize();
      const restored = PermissionSet.deserialize(serialized);

      expect(restored.id).toBe(original.id);
      expect(restored.label).toBe(original.label);
      expect(restored.workspacePath).toBe(original.workspacePath);
      expect(restored.hasNetwork).toBe(true);
    });
  });

  describe("permission checks", () => {
    it("checks network permission", () => {
      const perms = PermissionSet.create({
        id: "test",
        capabilities: [{ kind: "network" }]
      });
      expect(perms.allowsNetwork()).toBe(true);
    });

    it("checks network permission with domain restriction", () => {
      const perms = PermissionSet.create({
        id: "test",
        capabilities: [{ kind: "network", domains: ["example.com"] }]
      });
      expect(perms.allowsNetwork("example.com")).toBe(true);
      expect(perms.allowsNetwork("other.com")).toBe(false);
    });

    it("checks events permission", () => {
      const perms = PermissionSet.create({
        id: "test",
        capabilities: [{ kind: "events" }]
      });
      expect(perms.allowsEvents()).toBe(true);
    });

    it("checks file read permission", () => {
      const perms = PermissionSet.create({
        id: "test",
        capabilities: [
          { kind: "file:read", path: "/home/user/docs", recursive: true }
        ]
      });
      expect(perms.allowsReadSync("/home/user/docs/file.txt")).toBe(true);
      expect(perms.allowsReadSync("/home/other/file.txt")).toBe(false);
    });

    it("checks file write permission", () => {
      const perms = PermissionSet.create({
        id: "test",
        capabilities: [
          { kind: "file:write", path: "/home/user/workspace", recursive: true }
        ]
      });
      expect(perms.allowsWriteSync("/home/user/workspace/file.txt")).toBe(true);
      expect(perms.allowsWriteSync("/home/other/file.txt")).toBe(false);
    });

    it("write capability implies read", () => {
      const perms = PermissionSet.create({
        id: "test",
        capabilities: [
          { kind: "file:write", path: "/home/user/workspace", recursive: true }
        ]
      });
      // Should be able to read where we can write
      expect(perms.allowsReadSync("/home/user/workspace/file.txt")).toBe(true);
    });
  });

  describe("extension", () => {
    it("extends with additional capabilities", () => {
      const base = PermissionSet.create({
        id: "base",
        workspacePath: "/workspace"
      });

      const extended = base.extend([{ kind: "network" }]);

      expect(base.hasNetwork).toBe(false);
      expect(extended.hasNetwork).toBe(true);
      expect(extended.workspacePath).toBe("/workspace");
    });

    it("withNetwork adds network capability", () => {
      const perms = PermissionSet.empty().withNetwork();
      expect(perms.hasNetwork).toBe(true);
    });

    it("withEvents adds events capability", () => {
      const perms = PermissionSet.empty().withEvents();
      expect(perms.hasEvents).toBe(true);
    });

    it("withRead adds read capability", () => {
      const perms = PermissionSet.empty().withRead("/some/path");
      expect(perms.allowsReadSync("/some/path/file.txt")).toBe(true);
    });

    it("withWrite adds write capability", () => {
      const perms = PermissionSet.empty().withWrite("/some/path");
      expect(perms.allowsWriteSync("/some/path/file.txt")).toBe(true);
    });
  });

  describe("sandboxing", () => {
    it("removes network by default", () => {
      const perms = PermissionSet.create({
        id: "test",
        capabilities: [{ kind: "network" }, { kind: "events" }]
      });

      const sandboxed = perms.sandbox();
      expect(sandboxed.hasNetwork).toBe(false);
      expect(sandboxed.hasEvents).toBe(false);
    });

    it("keeps network when requested", () => {
      const perms = PermissionSet.create({
        id: "test",
        capabilities: [{ kind: "network" }]
      });

      const sandboxed = perms.sandbox({ keepNetwork: true });
      expect(sandboxed.hasNetwork).toBe(true);
    });

    it("keeps events when requested", () => {
      const perms = PermissionSet.create({
        id: "test",
        capabilities: [{ kind: "events" }]
      });

      const sandboxed = perms.sandbox({ keepEvents: true });
      expect(sandboxed.hasEvents).toBe(true);
    });

    it("restricts write paths", () => {
      const perms = PermissionSet.create({
        id: "test",
        capabilities: [
          { kind: "file:write", path: "/home/user/workspace", recursive: true },
          { kind: "file:write", path: "/tmp", recursive: true }
        ]
      });

      const sandboxed = perms.sandbox({ restrictWriteTo: ["/tmp"] });
      expect(sandboxed.allowsWriteSync("/tmp/file.txt")).toBe(true);
      expect(sandboxed.allowsWriteSync("/home/user/workspace/file.txt")).toBe(false);
    });
  });

  describe("audit", () => {
    it("generates comprehensive audit", () => {
      const perms = PermissionSet.create({
        id: "test-agent",
        label: "Test Agent",
        workspacePath: "/home/user/workspace",
        capabilities: [
          { kind: "network" },
          { kind: "events" },
          { kind: "file:read", path: "/home/user/docs", recursive: true }
        ]
      });

      const audit = perms.audit();

      expect(audit.id).toBe("test-agent");
      expect(audit.label).toBe("Test Agent");
      expect(audit.workspacePath).toBe("/home/user/workspace");
      expect(audit.network.allowed).toBe(true);
      expect(audit.events.allowed).toBe(true);
      expect(audit.write.length).toBeGreaterThan(0);
      expect(audit.read.length).toBeGreaterThan(0);
      expect(audit.summary.length).toBeGreaterThan(0);
    });

    it("includes summary messages", () => {
      const perms = PermissionSet.create({
        id: "test",
        capabilities: [{ kind: "network", domains: ["example.com"] }]
      });

      const audit = perms.audit();
      expect(audit.summary.some((s) => s.includes("example.com"))).toBe(true);
    });
  });

  describe("async checks", () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
      for (const dir of tempDirs) {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
      tempDirs.length = 0;
    });

    it("checks with symlink resolution", async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "perm-set-"));
      tempDirs.push(dir);
      const file = path.join(dir, "test.txt");
      await fs.writeFile(file, "content");

      const perms = PermissionSet.create({
        id: "test",
        capabilities: [{ kind: "file:read", path: dir, recursive: true }]
      });

      const result = await perms.check({ kind: "file:read", path: file });
      expect(result.allowed).toBe(true);
    });
  });
});
