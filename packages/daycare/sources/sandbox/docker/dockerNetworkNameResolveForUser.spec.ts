import { describe, expect, it } from "vitest";

import { dockerNetworkNameResolveForUser } from "./dockerNetworkNameResolveForUser.js";

describe("dockerNetworkNameResolveForUser", () => {
    it("uses local network for allowed users", () => {
        const network = dockerNetworkNameResolveForUser("user-2", ["user-1", "user-2"]);
        expect(network).toBe("daycare-local");
    });

    it("uses isolated network for users outside allowlist", () => {
        const network = dockerNetworkNameResolveForUser("user-3", ["user-1", "user-2"]);
        expect(network).toBe("daycare-isolated");
    });
});
