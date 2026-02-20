import { describe, expect, it } from "vitest";

import { sandboxAllowedDomainsValidate } from "./sandboxAllowedDomainsValidate.js";

describe("sandboxAllowedDomainsValidate", () => {
    it("rejects wildcard domains", () => {
        expect(sandboxAllowedDomainsValidate(["*"], true)).toEqual(['Wildcard "*" is not allowed in allowedDomains.']);
    });

    it("requires network permission when any domains are present", () => {
        expect(sandboxAllowedDomainsValidate(["example.com"], false)).toEqual([
            "Network permission is required to set allowedDomains."
        ]);
    });

    it("returns no issues for explicit domains with network permission", () => {
        expect(sandboxAllowedDomainsValidate(["example.com"], true)).toEqual([]);
    });

    it("requires allowedDomains when network permission is enabled", () => {
        expect(sandboxAllowedDomainsValidate([], true)).toEqual(["Network cannot be enabled without allowedDomains."]);
    });
});
