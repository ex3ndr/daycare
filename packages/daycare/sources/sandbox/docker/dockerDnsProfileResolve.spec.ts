import { describe, expect, it } from "vitest";

import { dockerDnsProfileResolve } from "./dockerDnsProfileResolve.js";

describe("dockerDnsProfileResolve", () => {
    it("uses public DNS for isolated network", () => {
        const profile = dockerDnsProfileResolve({
            networkName: "daycare-isolated"
        });
        expect(profile).toEqual({
            profileLabel: "public",
            dnsServers: ["1.1.1.1", "8.8.8.8"]
        });
    });

    it("uses configured public DNS for isolated network", () => {
        const profile = dockerDnsProfileResolve({
            networkName: "daycare-isolated",
            isolatedDnsServers: ["9.9.9.9", "8.8.4.4"]
        });
        expect(profile).toEqual({
            profileLabel: "public",
            dnsServers: ["9.9.9.9", "8.8.4.4"]
        });
    });

    it("uses default DNS for local network", () => {
        const profile = dockerDnsProfileResolve({
            networkName: "daycare-local"
        });
        expect(profile).toEqual({
            profileLabel: "default"
        });
    });

    it("uses configured private DNS for local network", () => {
        const profile = dockerDnsProfileResolve({
            networkName: "daycare-local",
            localDnsServers: ["192.168.0.1"]
        });
        expect(profile).toEqual({
            profileLabel: "private",
            dnsServers: ["192.168.0.1"]
        });
    });
});
