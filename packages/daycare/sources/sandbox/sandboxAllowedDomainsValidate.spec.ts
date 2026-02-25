import { describe, expect, it } from "vitest";

import { sandboxAllowedDomainsValidate } from "./sandboxAllowedDomainsValidate.js";

describe("sandboxAllowedDomainsValidate", () => {
    it("rejects wildcard domains", () => {
        expect(sandboxAllowedDomainsValidate(["*"])).toEqual(['Wildcard "*" is not allowed in allowedDomains.']);
    });

    it("returns no issues for explicit domains", () => {
        expect(sandboxAllowedDomainsValidate(["example.com"])).toEqual([]);
    });

    it("allows empty domain lists to keep networking disabled", () => {
        expect(sandboxAllowedDomainsValidate([])).toEqual([]);
    });
});
