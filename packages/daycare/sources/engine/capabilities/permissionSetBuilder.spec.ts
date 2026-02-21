import { describe, it, expect } from "vitest";
import path from "node:path";

import {
  PermissionSetBuilder,
  DerivationBuilder,
  Permissions
} from "./permissionSetBuilder.js";
import { PermissionSet } from "./permissionSet.js";

describe("PermissionSetBuilder", () => {
  describe("basic building", () => {
    it("creates empty permission set", () => {
      const perms = PermissionSetBuilder.create("test").build();
      expect(perms.id).toBe("test");
      expect(perms.capabilities).toHaveLength(0);
    });

    it("sets label", () => {
      const perms = PermissionSetBuilder.create("test")
        .withLabel("Test Permissions")
        .build();
      expect(perms.label).toBe("Test Permissions");
    });

    it("sets workspace", () => {
      const perms = PermissionSetBuilder.create("test")
        .workspace("/home/user/workspace")
        .build();
      expect(perms.workspacePath).toBe(path.resolve("/home/user/workspace"));
      expect(perms.writeCapabilities).toHaveLength(1);
    });
  });

  describe("capability methods", () => {
    it("adds network with no restrictions", () => {
      const perms = PermissionSetBuilder.create("test")
        .network()
        .build();
      expect(perms.hasNetwork).toBe(true);
      expect(perms.allowsNetwork("any.domain.com")).toBe(true);
    });

    it("adds network with domain restrictions", () => {
      const perms = PermissionSetBuilder.create("test")
        .network(["example.com", "*.api.example.com"])
        .build();
      expect(perms.hasNetwork).toBe(true);
      expect(perms.allowsNetwork("example.com")).toBe(true);
      expect(perms.allowsNetwork("api.example.com")).toBe(true);
      expect(perms.allowsNetwork("other.com")).toBe(false);
    });

    it("adds events", () => {
      const perms = PermissionSetBuilder.create("test")
        .events()
        .build();
      expect(perms.hasEvents).toBe(true);
    });

    it("adds read path", () => {
      const perms = PermissionSetBuilder.create("test")
        .read("/home/user/docs")
        .build();
      expect(perms.allowsReadSync("/home/user/docs/file.txt")).toBe(true);
    });

    it("adds write path", () => {
      const perms = PermissionSetBuilder.create("test")
        .write("/home/user/workspace")
        .build();
      expect(perms.allowsWriteSync("/home/user/workspace/file.txt")).toBe(true);
    });

    it("adds multiple read paths", () => {
      const perms = PermissionSetBuilder.create("test")
        .readPaths(["/path/a", "/path/b"])
        .build();
      expect(perms.allowsReadSync("/path/a/file.txt")).toBe(true);
      expect(perms.allowsReadSync("/path/b/file.txt")).toBe(true);
    });

    it("adds multiple write paths", () => {
      const perms = PermissionSetBuilder.create("test")
        .writePaths(["/path/a", "/path/b"])
        .build();
      expect(perms.allowsWriteSync("/path/a/file.txt")).toBe(true);
      expect(perms.allowsWriteSync("/path/b/file.txt")).toBe(true);
    });
  });

  describe("fluent chaining", () => {
    it("chains all methods", () => {
      const perms = PermissionSetBuilder.create("full-agent")
        .withLabel("Full Agent Permissions")
        .workspace("/home/user/workspace")
        .network()
        .events()
        .write("/home/user/documents")
        .read("/home/user/downloads")
        .build();

      expect(perms.id).toBe("full-agent");
      expect(perms.label).toBe("Full Agent Permissions");
      expect(perms.hasNetwork).toBe(true);
      expect(perms.hasEvents).toBe(true);
      expect(perms.allowsWriteSync("/home/user/workspace/file.txt")).toBe(true);
      expect(perms.allowsWriteSync("/home/user/documents/file.txt")).toBe(true);
      expect(perms.allowsReadSync("/home/user/downloads/file.txt")).toBe(true);
    });
  });

  describe("inheritance", () => {
    it("inherits from parent config", () => {
      const perms = PermissionSetBuilder.create("child")
        .inherit({
          id: "parent",
          capabilities: [{ kind: "network" }]
        })
        .build();

      expect(perms.hasNetwork).toBe(true);
    });

    it("inherits from existing PermissionSet", () => {
      const parent = PermissionSetBuilder.create("parent")
        .network()
        .events()
        .build();

      const child = PermissionSetBuilder.create("child")
        .inheritFrom(parent)
        .write("/extra/path")
        .build();

      expect(child.hasNetwork).toBe(true);
      expect(child.hasEvents).toBe(true);
      expect(child.allowsWriteSync("/extra/path/file.txt")).toBe(true);
    });
  });
});

describe("DerivationBuilder", () => {
  it("creates sandboxed permissions", () => {
    const source = PermissionSetBuilder.create("source")
      .workspace("/workspace")
      .network()
      .events()
      .build();

    const derived = DerivationBuilder.from(source)
      .revokeNetwork()
      .revokeEvents()
      .build();

    expect(derived.hasNetwork).toBe(false);
    expect(derived.hasEvents).toBe(false);
    expect(derived.allowsWriteSync("/workspace/file.txt")).toBe(true);
  });

  it("restricts write paths", () => {
    const source = PermissionSetBuilder.create("source")
      .writePaths(["/workspace", "/tmp", "/other"])
      .build();

    const derived = DerivationBuilder.from(source)
      .restrictWriteTo(["/tmp"])
      .build();

    expect(derived.allowsWriteSync("/tmp/file.txt")).toBe(true);
    expect(derived.allowsWriteSync("/workspace/file.txt")).toBe(false);
    expect(derived.allowsWriteSync("/other/file.txt")).toBe(false);
  });

  it("adds capabilities to derived set", () => {
    const source = PermissionSetBuilder.create("source")
      .workspace("/workspace")
      .build();

    const derived = DerivationBuilder.from(source)
      .addRead("/extra/read")
      .addWrite("/extra/write")
      .build();

    expect(derived.allowsReadSync("/extra/read/file.txt")).toBe(true);
    expect(derived.allowsWriteSync("/extra/write/file.txt")).toBe(true);
  });

  it("changes id and label", () => {
    const source = PermissionSetBuilder.create("source")
      .withLabel("Source")
      .build();

    const derived = DerivationBuilder.from(source)
      .withId("derived")
      .withLabel("Derived Set")
      .build();

    expect(derived.id).toBe("derived");
    expect(derived.label).toBe("Derived Set");
  });
});

describe("Permissions convenience functions", () => {
  it("creates workspace permissions", () => {
    const perms = Permissions.workspace("agent", "/home/user/workspace");
    expect(perms.workspacePath).toBe(path.resolve("/home/user/workspace"));
    expect(perms.hasNetwork).toBe(false);
  });

  it("creates workspace with network", () => {
    const perms = Permissions.workspaceWithNetwork(
      "agent",
      "/home/user/workspace"
    );
    expect(perms.hasNetwork).toBe(true);
  });

  it("creates workspace with network and domain restrictions", () => {
    const perms = Permissions.workspaceWithNetwork(
      "agent",
      "/home/user/workspace",
      ["example.com"]
    );
    expect(perms.allowsNetwork("example.com")).toBe(true);
    expect(perms.allowsNetwork("other.com")).toBe(false);
  });

  it("creates full permissions", () => {
    const perms = Permissions.full("agent", "/home/user/workspace");
    expect(perms.hasNetwork).toBe(true);
    expect(perms.hasEvents).toBe(true);
    expect(perms.workspacePath).toBe(path.resolve("/home/user/workspace"));
  });

  it("creates empty permissions", () => {
    const perms = Permissions.empty("test");
    expect(perms.capabilities).toHaveLength(0);
  });

  it("returns builder", () => {
    const builder = Permissions.builder("test");
    expect(builder).toBeInstanceOf(PermissionSetBuilder);
  });

  it("returns derivation builder", () => {
    const source = Permissions.empty();
    const derivation = Permissions.derive(source);
    expect(derivation).toBeInstanceOf(DerivationBuilder);
  });
});
