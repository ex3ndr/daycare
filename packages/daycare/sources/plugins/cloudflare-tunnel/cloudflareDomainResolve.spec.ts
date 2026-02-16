import { describe, expect, it } from "vitest";

import { cloudflareDomainResolve } from "./cloudflareDomainResolve.js";

describe("cloudflareDomainResolve", () => {
  it("extracts hostname/domain from json output", () => {
    const result = cloudflareDomainResolve(
      JSON.stringify({
        route: {
          hostname: "app.cloudflare.example.com"
        }
      })
    );

    expect(result).toEqual({
      hostname: "app.cloudflare.example.com",
      domain: "cloudflare.example.com"
    });
  });

  it("falls back to raw text hostname match", () => {
    const result = cloudflareDomainResolve("tunnel hostname: web.example.com");
    expect(result).toEqual({
      hostname: "web.example.com",
      domain: "example.com"
    });
  });
});
