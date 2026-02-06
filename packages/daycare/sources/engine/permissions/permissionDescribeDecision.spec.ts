import { describe, expect, it } from "vitest";

import { permissionDescribeDecision } from "./permissionDescribeDecision.js";

describe("permissionDescribeDecision", () => {
  it("describes web access", () => {
    expect(permissionDescribeDecision({ kind: "web" })).toBe("web access");
  });

  it("describes read access", () => {
    expect(permissionDescribeDecision({ kind: "read", path: "/tmp" })).toBe(
      "read access to /tmp"
    );
  });
});
