import { describe, expect, it } from "vitest";

import { dockerDnsProfileResolve } from "./dockerDnsProfileResolve.js";

describe("dockerDnsProfileResolve", () => {
    it("uses public DNS for isolated network", () => {
        const profile = dockerDnsProfileResolve("daycare-isolated");
        expect(profile).toEqual({
            profileLabel: "public",
            dnsServers: ["1.1.1.1", "8.8.8.8"]
        });
    });

    it("uses default DNS for local network", () => {
        const profile = dockerDnsProfileResolve("daycare-local");
        expect(profile).toEqual({
            profileLabel: "default"
        });
    });
});
