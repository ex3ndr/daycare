import { describe, expect, it } from "vitest";

import { permissionFormatTag } from "./permissionFormatTag.js";

describe("permissionFormatTag", () => {
  it("formats network permissions", () => {
    expect(permissionFormatTag({ kind: "network" })).toBe("@network");
  });

  it("formats events permissions", () => {
    expect(permissionFormatTag({ kind: "events" })).toBe("@events");
  });

  it("formats path permissions", () => {
    expect(permissionFormatTag({ kind: "read", path: "/tmp" })).toBe("@read:/tmp");
  });
});
