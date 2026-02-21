import { describe, it, expect } from "vitest";

import type {
  Capability,
  FileReadCapability,
  FileWriteCapability,
  NetworkCapability,
  PermissionCheck
} from "./types.js";

describe("Capability types", () => {
  it("creates network capability", () => {
    const cap: NetworkCapability = { kind: "network" };
    expect(cap.kind).toBe("network");
  });

  it("creates network capability with domains", () => {
    const cap: NetworkCapability = {
      kind: "network",
      domains: ["example.com", "*.api.example.com"]
    };
    expect(cap.kind).toBe("network");
    expect(cap.domains).toEqual(["example.com", "*.api.example.com"]);
  });

  it("creates events capability", () => {
    const cap: Capability = { kind: "events" };
    expect(cap.kind).toBe("events");
  });

  it("creates file read capability", () => {
    const cap: FileReadCapability = {
      kind: "file:read",
      path: "/home/user/downloads",
      recursive: true
    };
    expect(cap.kind).toBe("file:read");
    expect(cap.path).toBe("/home/user/downloads");
    expect(cap.recursive).toBe(true);
  });

  it("creates file write capability", () => {
    const cap: FileWriteCapability = {
      kind: "file:write",
      path: "/home/user/workspace",
      recursive: true
    };
    expect(cap.kind).toBe("file:write");
    expect(cap.path).toBe("/home/user/workspace");
    expect(cap.recursive).toBe(true);
  });
});

describe("PermissionCheck types", () => {
  it("creates network check", () => {
    const check: PermissionCheck = { kind: "network", domain: "example.com" };
    expect(check.kind).toBe("network");
  });

  it("creates events check", () => {
    const check: PermissionCheck = { kind: "events" };
    expect(check.kind).toBe("events");
  });

  it("creates file read check", () => {
    const check: PermissionCheck = {
      kind: "file:read",
      path: "/some/path"
    };
    expect(check.kind).toBe("file:read");
  });

  it("creates file write check", () => {
    const check: PermissionCheck = {
      kind: "file:write",
      path: "/some/path"
    };
    expect(check.kind).toBe("file:write");
  });
});
