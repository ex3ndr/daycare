import { describe, expect, it } from "vitest";

import { tailscaleStatusDomainResolve } from "./tailscaleStatusDomainResolve.js";

describe("tailscaleStatusDomainResolve", () => {
  it("parses dnsName and base domain", () => {
    const result = tailscaleStatusDomainResolve(
      JSON.stringify({ Self: { DNSName: "machine.tail123.ts.net." } })
    );

    expect(result).toEqual({
      dnsName: "machine.tail123.ts.net",
      domain: "tail123.ts.net"
    });
  });

  it("throws when dns name is missing", () => {
    expect(() => tailscaleStatusDomainResolve(JSON.stringify({ Self: {} }))).toThrow(
      "Self.DNSName"
    );
  });
});
