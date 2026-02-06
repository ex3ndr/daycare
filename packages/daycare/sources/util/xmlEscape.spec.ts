import { describe, expect, it } from "vitest";

import { xmlEscape } from "./xmlEscape.js";

describe("xmlEscape", () => {
  it("escapes XML special characters", () => {
    expect(xmlEscape("<tag>&\"'"))
      .toBe("&lt;tag&gt;&amp;&quot;&apos;");
  });
});
