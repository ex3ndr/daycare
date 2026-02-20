import { describe, expect, it } from "vitest";

import { customTunnelDomainResolve } from "./customTunnelDomainResolve.js";

describe("customTunnelDomainResolve", () => {
    it("parses hostname from URL output", () => {
        expect(customTunnelDomainResolve("https://app.example.com/path?x=1")).toEqual({
            domain: "app.example.com",
            publicUrl: "https://app.example.com/path?x=1"
        });
    });

    it("accepts plain host output", () => {
        expect(customTunnelDomainResolve("plain.example.com")).toEqual({
            domain: "plain.example.com",
            publicUrl: "plain.example.com"
        });
    });

    it("strips port from host:port output", () => {
        expect(customTunnelDomainResolve("plain.example.com:8443")).toEqual({
            domain: "plain.example.com",
            publicUrl: "plain.example.com:8443"
        });
    });
});
