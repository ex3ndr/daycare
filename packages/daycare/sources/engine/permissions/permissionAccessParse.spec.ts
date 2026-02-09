import { describe, it, expect } from "vitest";

import { permissionAccessParse } from "./permissionAccessParse.js";

describe("permissionAccessParse", () => {
  it("parses @network and @events", () => {
    expect(permissionAccessParse("@network")).toEqual({ kind: "network" });
    expect(permissionAccessParse("@events")).toEqual({ kind: "events" });
  });

  it("parses @read and @write paths", () => {
    expect(permissionAccessParse("@read:/tmp")).toEqual({ kind: "read", path: "/tmp" });
    expect(permissionAccessParse("@write:/var/log")).toEqual({ kind: "write", path: "/var/log" });
  });

  it("rejects invalid tags", () => {
    expect(() => permissionAccessParse("read:/tmp")).toThrow("Permission must be");
  });
});
