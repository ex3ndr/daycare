import { describe, expect, it } from "vitest";

import { sandboxAllowedDomainsValidate } from "./sandboxAllowedDomainsValidate.js";

describe("sandboxAllowedDomainsValidate", () => {
    it("allows global wildcard to disable domain restrictions", () => {
        expect(sandboxAllowedDomainsValidate(["*"])).toEqual([]);
    });

    it("returns no issues for explicit domains", () => {
        expect(sandboxAllowedDomainsValidate(["example.com"])).toEqual([]);
    });

    it("allows empty domain lists to keep networking disabled", () => {
        expect(sandboxAllowedDomainsValidate([])).toEqual([]);
    });
});
