import { describe, expect, it } from "vitest";

import { releaseVersionIsValid } from "./releaseVersionIsValid.js";

describe("releaseVersionIsValid", () => {
  it("accepts stable semver values", () => {
    expect(releaseVersionIsValid("1.2.3")).toBe(true);
  });

  it("accepts prerelease and build metadata", () => {
    expect(releaseVersionIsValid("1.2.3-beta.1+build.42")).toBe(true);
  });

  it("rejects invalid versions", () => {
    expect(releaseVersionIsValid("v1.2.3")).toBe(false);
    expect(releaseVersionIsValid("1.2")).toBe(false);
  });
});
