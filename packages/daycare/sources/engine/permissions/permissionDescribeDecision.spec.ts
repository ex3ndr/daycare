import { describe, expect, it } from "vitest";

import { permissionDescribeDecision } from "./permissionDescribeDecision.js";

describe("permissionDescribeDecision", () => {
  it("describes network access", () => {
    expect(permissionDescribeDecision({ kind: "network" })).toBe("network access");
  });

  it("describes events access", () => {
    expect(permissionDescribeDecision({ kind: "events" })).toBe("events access");
  });

  it("describes read access", () => {
    expect(permissionDescribeDecision({ kind: "read", path: "/tmp" })).toBe(
      "read access to /tmp"
    );
  });
});
