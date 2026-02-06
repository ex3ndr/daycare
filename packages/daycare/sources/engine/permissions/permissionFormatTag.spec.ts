import { describe, expect, it } from "vitest";

import { permissionFormatTag } from "./permissionFormatTag.js";

describe("permissionFormatTag", () => {
  it("formats web permissions", () => {
    expect(permissionFormatTag({ kind: "web" })).toBe("@web");
  });

  it("formats path permissions", () => {
    expect(permissionFormatTag({ kind: "read", path: "/tmp" })).toBe("@read:/tmp");
  });
});
